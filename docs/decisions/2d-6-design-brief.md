# Design consult brief — Phase 2d-6, components, i18n and mounted evidence

_Written 2026-09-21, before any line of 2d-6 exists, so the rulings can be read against what was asked. The shape is
`docs/decisions/2d-5-design-brief.md`'s: bounds named to the consultant rather than hidden._

## 1. Operating conditions — read these first

- **Do NOT use web search and do NOT fetch URLs.** Everything you need is in this repository. **Root:**
  `/Users/ccarpio/Developer/Utils/espansoConfig`. **Branch:** `main` — a Rust workspace (`crates/`, `src-tauri/`) plus a
  Svelte 5 / Tauri v2 frontend (`src/`).
- **The working tree is deliberately not clean, and that is not this phase's work.** `git status --short` shows four
  uncommitted instrument paths — `src-tauri/src/main.rs` and `src/main.ts` (two hook lines each, `5 insertions(+),
  1 deletion(-)` between them), `src-tauri/src/probe.rs` and `src/probe.ts` — and a modified `PROGRESS.json`. They are
  the temporary window-reading instrument (`PROGRESS.md` *Next action*, "READ FIRST"); 2d-8 deletes it. Do not read
  them as part of what 2d-6 wires, and do not propose touching them.
- **Read freely. The workspace may be mounted read-only and you may be unable to write any file. That is expected and it
  must not affect your verdict** — **your final message IS the deliverable**, captured verbatim by the caller into
  `docs/reviews/phase-2d-6-design.md`. Do not try to write it, and do not tell the caller to run anything to get it.
- **Do not run `cargo` or `npm`** — the suite takes minutes and the Rust gate is only authoritative serially on this
  host. A sandbox limit or an unrunnable gate is not a finding and not a reason to hedge: say in one line what you could
  not verify, and rule anyway. This is an adversarial **design consult**, not a review: be decisive.

## 2. The rules that dominate every design here

Read `CLAUDE.md` at the root — all of it — before ruling. **(1)** A decision record claiming a guarantee the code does not
give is this project's worst defect class: where TypeScript cannot force something, say so in the same sentence that says
what it does force. **(2)** Decisions live in `src/lib/browser/` as values and components draw them; a rule written into
one renderer is carried by that renderer's mounted suite alone, and a second renderer can omit it while walking the model
faithfully. Deciding *what* to draw and *whether* to draw it are two rules, and only a renderer can own the second
(`RecoveryWithoutCreation.svelte` is the pattern). **(3)** The review policy is the autoclaude workflow's, and `CLAUDE.md`
§7 adds nothing to it: **one adversarial review per phase; blockers fixed and verification re-run; the phase closes. A
fix is not owed a review, no phase is ever created to re-review a fix, and no phase is named as a letter appended to its
parent.** The rule this replaced — a fix round that changed a source file commissions a review round — was removed on
2026-09-20 after a fourteen-round tail on 2d-5-3 and a seven-phase one on 2d-5-4; the 2d-5 brief's §2 rule (3) quotes
the old rule and must not be reproduced. **(4)** A green suite is not a screen: a mounted test proves a handler fires, not
that a window draws (`CLAUDE.md:202-204`).

Also read `docs/reviews/phase-2d-design.md` (**item 6 of its Q7 is this phase's definition**, at `:128`; Q4 the no-draft
path, Q5 the draft path, **Q6 the five offers and the sentences each may never say**, Q8 the sharpest green-suite
failure); `docs/reviews/phase-2d-5-design.md` (**the consult that bound 2d-5; it binds here where it speaks**);
`docs/decisions/2d-5-split-notes.md` §3 (the 35 rulings), **§5 (its corrections override `phase-2d-design.md`)** and §6
(what it left unsettled — items 2, 4, 6 and 7 are 2d-6's material); the three *where it is thin* lists —
`docs/decisions/2d-5-5b-notes.md` §6 (fourteen items), `docs/decisions/2d-5-7a-notes.md` §6 (ten) and
`docs/decisions/2d-5-7b-window-reading.md` §10 (ten) — plus `2d-5-5a-notes.md` §5 and §8; and `PROGRESS.md`'s *Next
action* (open items 0-11, especially **5, 8 and 9**), *Standing rules* and *Open risks* (R27, R31, R32, R35, R36, R37,
R38, R39).

## 3. What exists today, verified by reading the files for this brief

Every range below was opened and read on the current tree while writing this. **Every "has no production caller" and
"drawn nowhere" claim was checked with `rg` over `src/` and `scripts/` excluding `*.test.ts`**, and where a cited range
in an older document no longer resolves that is said in the *Drift* paragraph rather than left for you to trip over.

| Fact | Where |
|---|---|
| `AppShell.svelte` builds the state over `REAL_COMMANDS`, `reportIpcFailure`, `REAL_BACKUP_COMMANDS`, `REAL_RECONCILIATION_EVENTS` and **`INERT_FOREGROUND_EVENTS`**; `onMount` calls `start()`, then `open(null)`, and returns `dispose`. `DetailPane` gets one prop, `browser` | `src/lib/components/AppShell.svelte:51-57`, `:59-88`, `:142`; `src/lib/browser/workspace.svelte.ts:2282-2286`, `:2581`, `:5309-5317` |
| The registry is complete by construction in one file: `openSurfaces` is a `satisfies Record<OpenWriteSurfaceKind, …>` assembly of **seven** entries, the creator's target `unknown` until `MatchCreator` reports a destination; `reconcileWriteSurfaces` runs from one `$effect`; `busy` keeps the seven mutually exclusive and gates the *new snippet* control | `src/lib/components/DetailPane.svelte:571-617`, `:754-799`, `:814`, `:1008-1016`, `:1164`; `src/lib/components/MatchCreator.svelte:423`, `:431-433`; `src/lib/browser/restore.ts:341-352`, `:424`, `:472`, `:543`, `:604` |
| **Every registered transition is `tellNobodyYet`, one no-op closure for all seven kinds, registered in the parent** — and it *is* called: `tellTheSurfaceAbout` in the transitions module reads `transitionFor(kind)` and invokes it with the narrowed `Changed`/`Projected` snapshot. `WriteSurfaceTransition` answers `void`; a `Removed` or `Unreadable` observation reaches no surface by type | `src/lib/components/DetailPane.svelte:642-669`, `:717`; `src/lib/browser/observationTransitions.ts:546-585`, `:1339-1359`; `src/lib/browser/writeSurfaceRegistry.ts:130` |
| **Each surface's session lives in its own child component as `$state.raw`**, and each child takes narrow function props (`save`, `adoptDiskVersion`, `close`, …), never `browser` | `src/lib/components/MatchEditor.svelte:231-293`; `MatchCreator.svelte:258`; `MatchDeleter.svelte:197`; `MatchMover.svelte:308`; `MatchDuplicator.svelte:285`; `RawEditor.svelte:196`; `DetailPane.svelte:1175-1182`, `:1188-1200` |
| **Every session's `outcome` is `SaveOutcomeModel<T> \| null`, whose conflict arm is `SaveConflictModel<T>` — the save arm and not the union, by design** (2d-5-5a §5); the eight `conflictOf`-shaped accessors answer `SaveConflictModel<…> \| null` while the eight **view** interfaces already declare `ConflictModel<…> \| null`; `beginReapply` takes `SaveConflictModel<T> \| null` and its doc says 2d-6 undoes that deliberately | `src/lib/browser/saveOutcome.ts:810`, `:863-873`, `:886`, `:901`; `matchEditor.ts:638`, `:1079`, `:2223`; `rawEditor.ts:178`, `:465`, `:1010`; `matchCreation.ts:541`, `:733`, `:1738`; `matchDeletion.ts:359`, `:471`, `:1011`; `matchMove.ts:691`, `:869`, `:2332`; `matchDuplication.ts:432`, `:585`, `:1418`; `restore.ts:1368`, `:1943`, `:3172`; `recovery.ts:874`, `:1225`, `:2352`; `editorSave.ts:233`; `reapply.ts:309-320` |
| **Eight renderers read `conflict.expected` and `conflict.found`** — fields an `ExternalConflictModel` does not have, by type — and draw the disk side through `SourceText … documentStart`, the choices from `view.conflictChoices`, the reapply line, the copy result and the two-step reload warning | `MatchEditor.svelte:981-985`, `:1004-1016`, `:1050-1056`; `MatchCreator.svelte:957-959`; `MatchDeleter.svelte:614-616`; `MatchMover.svelte:896-898`; `MatchDuplicator.svelte:793-796`; `RawEditor.svelte:593-594`; `RestorePane.svelte:1002-1004`; `RecoveryPanel.svelte:742-744` |
| The seven capability declarations: five `closesSurface`, the raw editor `reseedsDraft`, restore `retargetsCandidate`; reapply supported on the five match surfaces and `unavailable` on the raw editor and restore; copy only on the three authored-text surfaces. `conflictChoicesFor` is still the only producer | `matchEditor.ts:2139-2145`; `matchCreation.ts:1683-1689`; `matchDeletion.ts:965-971`; `matchMove.ts:2009-2015`; `matchDuplication.ts:1330-1336`; `rawEditor.ts:242-248`; `restore.ts:1436-1442`; `saveOutcome.ts:543-560` |
| **Test-only today, verified by `rg`: `observeExternalChange`, `rememberExternalConflict`, `standingConflictFor`, `writeInFlight`, `retainedObservationFor`, `writeOutcomeUncertain`, `describeExternalConflict` (called only by `supersedeConflict`, itself uncalled), `reapplyEvidenceFor`, `tConflictOriginMessage`, `tExternalEvidenceRefusal`, `tSupersededEvidence`** — each defined, none reached from `src/lib/components/`, `src/main.ts` or anything else outside its defining module. `ObservationVerdict` has six arms (`retained`, `raised`, `raisedWithoutReload`, `supersedes`, `coalesced`, `notLater`); `ReapplyEvidenceAccess` four (`saveEvidence`, `externalCorrespondence`, `refused`, `superseded`) | `workspace.svelte.ts:1205-1207`, `:1244`, `:1257`, `:1265`, `:1275`, `:1288`, `:4096-4128`; `saveOutcome.ts:1111`, `:1178-1189`; `reapply.ts:333`, `:360-408`, `:436`, `:500-511`; `conflictSource.ts:85-121`, `:393-459`, `:461`, `:510`, `:627`; `src/lib/i18n/index.ts:826`, `:1423`, `:1437`, `:1458`, `:1468` |
| The dictionaries hold **942** keys each. Drawn by nothing: `browser.conflictOrigin.{refusedSave,changedWhileOpen}`, `browser.reapply.externalEvidence.{noCorrespondence,baseRevisionMoved,diskRevisionMoved}`, `browser.reapply.supersededConflict`. The wire enums already have `code.externalObservation.*` and `code.unreadableReason.*` with `describe*` accessors. **No `browser.*` key exists for any coordinator state** — nothing for `stale`/`unavailable`/`removed`, `notWatched`, `blockedByLostHistory`, a failed registration, a wanted membership reload, an uncertain write or a path drift | `src/lib/i18n/en.json:152-155`, `:198-199`, `:1003-1012`; `src/lib/i18n/codes.ts:1560`, `:1570`, `:1612`, `:1634`; `index.ts:1414-1417`, `:1451-1453` |
| **What `BrowserState` exposes of the coordinator, and how**: `externalDocumentStatus` and `externalPathDrift` read `$state` mirrors; `reconciliationBlock()` and `membershipReloadWanted()` are **straight through and deliberately not mirrored** ("2d-6 is where a window derives from it"). **Not exposed at all**: the coordinator's `watchState()` (the `notWatched` arm) and `registration()` (the `failed` arm) — a rejected `subscribe` lands on `registrationState` and is neither reported nor reachable from a component | `workspace.svelte.ts:2134`, `:2145`, `:2153`, `:2164`, `:2517`, `:2545`, `:5388-5410`; `reconciliationCoordinator.ts:163-184`, `:231-245`, `:253-278`, `:620`, `:626`, `:1585-1596` |
| **Native watcher degradation is not on the wire.** `WatchStatusView { epoch, ready, polling }` is read by `watch_check` only; `WorkspaceSession::watch_status` says "nothing in production reads it yet"; `generate_handler!` registers sixteen application commands plus `set_menu_labels` — the **seventeen** `dispatch_check.rs` asserts — and the batch carries `epoch`, `newest_sequence`, `observations`, `discarded` and nothing about the backend | `src-tauri/src/watch.rs:476-503`; `src-tauri/src/commands.rs:753-765`; `src-tauri/src/main.rs:243-260`; `src-tauri/src/dispatch_check.rs:1`; `src/lib/ipc/types.ts:3077-3110` |
| Ruling 12's exit as shipped: **closing the last surface *permits* the reload and does not *trigger* it**; the permission is re-evaluated at the next accepted batch, and "2d-6 is where a person gets a control that asks". A removed selected file clears selection through `replaceSelection` with the `gone` notice and leaves any surface over it registered and untold | `reconciliationCoordinator.ts:189-228`; `workspace.svelte.ts:3460-3480`; `src/lib/browser/notices.ts:82-85` |
| `ForegroundSource` is synchronous by contract; `INERT_FOREGROUND_EVENTS` registers a handler that is never called; nothing in `bootstrap.ts`, `main.ts`, `App.svelte` or `AppShell.svelte` runs `dispose()` on a window close (no `beforeunload`, `pagehide` or unmount path) | `reconciliationCoordinator.ts:399-407`, `:458-478`; `2d-5-7b-window-reading.md` §4.5, §5 item 3 |
| **Ten test files opt into jsdom**; `environment: 'node'` is the default. `DetailPane.test.ts` and `RestorePane.test.ts` assert `invoked` exactly zero file-wide; `AppShell.test.ts` mounts the real composition and asserts the exact `invoke` list per case instead (open item 6 — not to be "fixed"). **Bilingual mounted precedent is `RestorePane.test.ts` alone**: one `locale.setOverride('es')` re-render and an `it.each` over `LOCALES`; no other mounted suite switches locale | `vite.config.ts:65`; `DetailPane.test.ts:587-596`; `AppShell.test.ts:322-345`; `RestorePane.test.ts:926`, `:1541-1542`, `:1570` |
| The hardcoded-string scan reads `.svelte` markup only — `<script>` bodies, `{expr}` provenance, `.ts` strings and props are its named blind spots (R31); the dictionary suite's Spanish check is a non-identity heuristic (R35). The capability file holds exactly `core:event:allow-listen` and `core:event:allow-unlisten` | `scripts/lint/hardcoded-strings.ts:21-37`; `src/lib/i18n/dictionaries.test.ts:14`, `:72`; `src-tauri/capabilities/default.json:6` |
| **Prose that hands 2d-6's work to "2d-5-5", which closed without doing it**: five sentences in production source, plus open item 9's "Nothing in this file calls it" and the coordinator header's "every registered transition is a no-op today" (true, wrongly forwarded). `main.rs:214-227` still claims `"permissions": []` and is 2d-8's because the file carries the instrument | `workspace.svelte.ts:346-349`, `:3455-3456`; `observationTransitions.ts:580`; `writeSurfaceRegistry.ts:49-50`, `:107-109`; `DetailPane.svelte:658`; `reconciliationCoordinator.ts:53-54`; `saveOutcome.ts:855-859`; `src-tauri/src/main.rs:214-227` |

**Drift.** `docs/reviews/phase-2d-design.md` item 6 cites `CLAUDE.md:390-393` and `:519-526`; `CLAUDE.md` is 258 lines
since its 2026-09-20 rewrite and the rule those ranges carried is now at `:202-204`. Its Q8's `DetailPane.svelte:453-469`
was the pre-registry producer and now lands in the restore session's doc comments — the assembly is `:571-617` — and its
`workspace.svelte.ts:1786-1804` and `:3540-3556` are now `installView` at `:3361-3371` and `repairAfter` at `:5931-5947`.
Every `workspace.svelte.ts` range in `docs/reviews/phase-2d-5-design.md` and in the 2d-5 brief's §3 has moved (the file
is 5 948 lines, from 3 588); the table above is the re-derived set. `2d-5-5b-notes.md` §2's `arbitrateHere` at `:2963`
and `beginWrite` at `:3074` are now `:2968` and `:3079`. `2d-5-7a-notes.md` §6 item 1's `AppShell.svelte:56` still
resolves. `CLAUDE.md` §4's figures are dated anchors — **`PROGRESS.md` is authoritative**: `1323 / 444 / 2474 / 191`
with the instrument in the tree, 190 modules on a committed one.

## 4. What Phase 2d-6 is

`docs/reviews/phase-2d-design.md` Q7 item 6, verbatim:

> **2d-6 — components, i18n, and mounted evidence.** Wire the coordinator through the shell/`DetailPane` and all seven
> write surfaces; draw external-origin messages, the existing compare/copy/reapply/reload/recovery offers, watcher
> degradation, removal, and unreadable states. Every changed renderer gets mounted interaction coverage in English and
> Spanish. The mounted matrix must prove that a pristine surface conflicts, raw view auto-refreshes, restore retains its
> candidate, wildcard creator blocks automatic reload, an external conflict cannot submit, every enabled control has a
> handler, and no direct IPC import bypasses `BrowserState`. This is the phase's mounted evidence, not its screen reading;
> jsdom does not lay out or prove WKWebView delivery (`CLAUDE.md:390-393`, `CLAUDE.md:519-526`).

**What the 2d-5 record changed underneath it.** "Wire the coordinator through the shell" is done: 2d-5-7a activated it,
and the registry has been exact in `DetailPane` since 2d-5-2. What remains of the first sentence is the *telling* half —
seven no-op transitions and a surface-side answer. `2d-5-split-notes.md` §5.2 rules that **a step touching components
owes mounted evidence and a narrow window regression reading**, while item 6 says this phase's evidence is mounted and
not a screen reading — the two must be reconciled (Q8). §5.4 settled automatic reload as `applyExternalObservation`
delegating to the guarded reread, which 2d-5-4 shipped as `rereadUnderGuard`; the raw viewer *may* refresh (ruling 20)
and does. §6 item 2 left the coordinator's home to the steps, and it became four plain modules beside
`workspace.svelte.ts`; item 4's blocked-state exit is typed as *permit, not trigger*; item 6 owes `notWatched`'s keys to
whichever step first names it; item 7 says no window reading here may claim wake delivery.

**The three obligations 2d-5-5b handed on** (`PROGRESS.md` *Next action*): **(1)** `observeExternalChange` and
`supersedeConflict` have no production caller; wiring the arbitration in front of `tellTheSurfaceAbout` needs a decision
about a new `ReconciliationWorkspace` member and about what a `retained` verdict does to a surface (5b §6 items 2, 7).
**(2)** An exception-safe close charges a `mayHaveWritten` uncertainty only a later write or `open()` clears, and there
is no surface to clear it because the panel is 2d-6's (items 4, 13). **(3)** A verdict decided against a state that
moved underneath it retains its observation and nothing guarantees it is looked at again; a bounded re-arbitration is a
deliberate later decision (item 14). Plus open item **5** (the seven test-only surfaces), **8** (the inert
`ForegroundSource`) and **9** (the stale `drainExternalChanges` doc).

## 5. Constraints you may not trade away

Settled; a ruling that contradicts one is wrong, not brave. **`save_document` is the only entry point that may write a
user's file**, there is no `force` flag, 2d-6 introduces no writer, and **no save command may ever be initiated by
watcher arbitration** (ruling 27). **`adoptDiskVersion` is the only confirmed-install door**, `alreadyThere` is success,
`refused` closes nothing. **`conflictChoicesFor` is the only producer of a `ConflictChoice` list.** **A component renders
a code by calling a typed accessor, never by building a key**, every user-facing string is EN **and** ES, and no
sentence may say *merged*, *newer*, *deleted*, *saved* or *the same snippet was found* where the model cannot earn it
(consult Q6). **The conservative sentence claims an open surface, never a dirty draft** (ruling 19; R36). **`installView`
→ `repairAfter` → `readFileText` in that order, and every write to `selected` bumps a counter in the same synchronous
block.** **A raw editor's `<textarea>` normalizes `\r`**, so every new textarea or input decides that deliberately.
**`crates/espansoconfig-core` must never depend on `tauri`.** **D2r, R25, D2u.**

---

# The questions

Answer each with a **Ruling:** line, then the reasoning, then `file:line` evidence you derived; where uncertain, say which
observation would settle it.

### Q1 — Delivering an observation into a session the parent does not hold

The registered transition is one closure in `DetailPane` (`:669`, `:717`); the session it must change lives in a child
as `$state.raw`; the children take narrow function props and never `browser`. Rule on the route: (a) the parent keeps a
per-kind delivered-observation slot and passes it down as a prop the child derives from; (b) the child hands the parent
a handler through a callback prop and the parent's transition dispatches to it — a second map beside the registry; (c)
the child registers its own transition, which breaks ruling 1's one-file exhaustiveness. Then rule on **where
`observeExternalChange` is called** — the parent's transition has the `DocumentId` and gets a synchronous verdict, but
`describeExternalConflict` needs the child's draft and capabilities — and on whether 5b §6 item 2's "new
`ReconciliationWorkspace` member" is needed at all if the arbitration sits inside the registered transition rather than
in front of `tellTheSurfaceAbout`. Say what the type forces and what only a mounted test can.

### Q2 — Where an external conflict lives in a surface's session, and what "cannot submit" rests on

`outcome` is `SaveOutcomeModel<T>` on every session and its conflict arm is the save arm by deliberate decision
(2d-5-5a §5), so an external conflict cannot be assigned into it today; the view props are already the union. Rule on
(a) a second session field versus (b) widening `outcome` back and taking `expected`/`found` away from eight renderers,
versus (c) a per-surface `ConflictModel` slot outside `outcome`. Rule on how *an external conflict cannot submit* is
enforced as a **model** rule each of the seven surface modules carries (R37: one read of the projection, one synchronous
block), not a renderer's. The nested discriminant does not narrow the parent (5a §8 item 1): say what the eight
`revisionExpected`/`revisionFound` lines become for the external arm, and whether one shared conflict renderer replaces
eight or each surface keeps its own.

### Q3 — What each of the six verdicts does to a surface, and the uncertainty only a surface can end

Rule per arm: `raised` and `raisedWithoutReload` build the model — with what reload capability for the second; `supersedes`
replaces it through `supersedeConflict`, and say who resets the surface's two-step reload state and pending confirmation
(ruling 26 says withdrawn — `adoptDiskVersion` withdraws its own memo, but the surface's `awaitingReloadConfirmation` is
session state); `coalesced` and `notLater` change nothing; **`retained`** — held for a write in flight *or* because the
state moved underneath the arbitration — say whether the surface learns anything at all, and what sentence, if any, is
honest. Then **`writeOutcomeUncertain`**: 5b §6 items 4 and 13 say a file that met a rejected write keeps the uncertainty
until a write of this window's own ends on a named revision or `open()`, and every later verdict is
`raisedWithoutReload`. Rule on the surface that lets a person end an uncertainty they have looked at: what it says, what
it spends, which state member it calls, and why that is not a second door or a hidden `force`.

### Q4 — Bounded re-arbitration

A retained observation is released only by a write settlement for that file or by `open()` (5b §6 item 14), so one held
because the arbitration was re-entered may never be looked at again. Rule on whether 2d-6 adds a re-arbitration trigger
— on surface close, on the next accepted batch, on a person's ask — or draws the held state and stops; what bounds it
(one re-run per trigger? per observation?); and what makes it impossible for a re-arbitration to install anything, given
`observeExternalChange` reaches no command and `adoptDiskVersion` refuses an origin that no longer stands.

### Q5 — Drawing the external origin and the five offers without a new producer

The eight conflict panels live inside the `outcome` branch and draw compare (`SourceText … documentStart`), copy
(`copyReferenceText`, refusing `\r` on the textarea carrier), the two-step reload, the reapply line and recovery. Rule on
what the external panel adds — `tConflictOriginMessage` for the origin line, `tExternalEvidenceRefusal` and
`tSupersededEvidence` where *Keep my draft* resolves to manual resolution — and what it may not say (consult Q6). Rule
on **reapply for an external conflict**: `beginReapply` refuses the arm by type, `ReapplyEvidenceAccess.externalCorrespondence`
hands back a whole-file table no surface consumes, and turning it into a subject needs the surface's base `MatchId`
(5a §8 items 2-3). Does 2d-6 build that lookup for the five match surfaces, or offer `keepMyDraft` and resolve it to
manual resolution with the refusal sentence — and which is honest given `conflictChoicesFor` keys `keepMyDraft` on
capabilities that say `supported`? Say what the recovery panel's `RecoveryOrigin.conflict` (now a `ConflictSource`) needs.

### Q6 — Watcher degradation, removal and unreadable states on screen

The frontend can know: per-file `stale`/`unavailable`/`removed` (a `$state` mirror), path drift (`$state`),
`blockedByLostHistory` and a wanted membership reload (straight-through reads, unmirrored), and — on the coordinator only,
unexposed — `notWatched` and a failed registration. **The native polling fallback is not on the wire at all.** Rule on
(a) what "watcher degradation" honestly means for 2d-6 and whether an eighteenth command exposing `WatchStatusView` is
in scope (Rust, `wire_contract.rs`, the seventeen-command table, a `dispatch_check.rs` re-run) or a later phase's; (b)
which states 2d-6 draws, where (sidebar row, detail header, a shell banner), and which `BrowserState` readers gain a
mirror; (c) the **two controls** the records owe a person — a membership reload and the blocked state's exit
(ruling 12: closing permits, does not trigger) — what each calls, and how neither becomes a second `open()` door; (d)
what a surface over a `removed` file is told, given the transition type cannot carry a removal; (e) whether a `stale` file
whose surface has closed is reread automatically or on ask.

### Q7 — The inert `ForegroundSource` (open item 8)

`AppShell` passes `INERT_FOREGROUND_EVENTS` because no production source exists; a window returning to the foreground or
a machine resuming requests no drain. Rule on whether it is 2d-6's — the only phase wiring components until 2d-7 — or its
own phase; DOM `visibilitychange` plus `focus` versus Tauri's window focus event (both listen through the already-granted
event permissions — say if you find otherwise); the synchronous-subscribe contract; the one-module Vite cost; and what a
mounted `AppShell.test.ts` case can prove about it versus what only a window can (a wake dropped while occluded is 7b §5).

### Q8 — Mounted evidence: what the matrix proves, what it cannot, and whether a window is owed

Rule on the mounted matrix item 6 names — pristine surface conflicts, raw view refreshes, restore retains its candidate,
unknown-target creator blocks reload, external conflict cannot submit, every enabled control has a handler, no direct IPC
import — as concrete cases over which suites, and on what each proves under R32 (a handler fired, never a screen). Rule
on what **"in English and Spanish" means for a mounted suite** when R35 says a Spanish assertion proves a key resolved,
not that the sentence is Spanish, and the only bilingual mounted precedent is `RestorePane.test.ts`. Rule on the
`invoked` assertion shape per file — exact zero versus `AppShell.test.ts`'s exact list — and on the route-guard
residue (open item 6: nothing stops a new test file importing `$lib/ipc/commands` with no spy). Then **reconcile §5.2
with item 6**: does a phase that changes eight renderers owe a narrow window regression reading (harness at
`/private/tmp/espansoconfig-harness-2d-5-7b/`, `lifecycle-delivery` as the trigger per 7b §9), or is every screen claim
2d-7's? If a reading is owed, say what it may not claim (wake delivery; R38's window half).

### Q9 — The i18n additions and the two blind spots

Every state Q3, Q5 and Q6 draw needs EN and ES entries and a typed accessor; today the browser-model accessors live in
`src/lib/i18n/index.ts` (2d-5-5a §3's deviation, stated) while the coordinator's own docs say `codes.ts`. Rule on the
placement, on the key namespaces, on which codes carry operands (none may show a hex digest beside a refusal), and on
the sentence bounds: a `stale` status may not say what changed or who; `notWatched` may not read as coverage; a failed
registration may not say the watcher is dead. Then rule on evidence: the markup scan cannot see a `.ts` string (R31),
the dictionary suite cannot see meaning (R35), and `dictionary_contract.rs` covers the `code.` namespace only — say what
2d-6 pins beyond key parity, and what it states in words as unpinned.

### Q10 — Prose debts a components phase may correct, and which it must not

Five production sentences forward this work to "2d-5-5"; open item 9's doc says nothing in the file calls
`drainExternalChanges`; `ExternalConflictModel`'s doc and three accessor docs say nothing draws them — each becomes false
the moment 2d-6 lands. Rule on which a 2d-6 step corrects in the same diff that falsifies it, and on the two it must
leave: `main.rs:214-227` (instrument file, 2d-8's) and the drifted `file:line` citations in comments (open item 1 — a
checker, not a hand edit). Say whether a step may correct a sentence in a module it does not otherwise change.

### Q11 — How 2d-6 is cut into sub-steps

Name the sub-steps (`2d-6-1`, `2d-6-2`, …), **dependency-ordered**, each small enough for one worker, and for each say
(a) what it delivers, (b) what evidence it owes — model tests, mounted evidence, a window reading, or the machine-checkable
gate set alone — and (c) which `.svelte` files it may touch. Say which step gives the 5b pair its production callers,
which step first names a coordinator state to a person and so owes its keys, whether the `ForegroundSource` is in, and
which step re-measures the four baselines — **a new `.ts` module moves `npm run build` by one, a styled component by two,
and the instrument's own contribution (Rust 0, svelte-check +1, vitest +1, Vite +1) must be subtracted before comparing**.

## 6. Your output contract

- **Your final message is the deliverable.** Write no file. **Use `###` for your own internal headings, never `##`** —
  one `## VERDICT`-style header of your own at the top is fine, and everything under it is `###`.
- **Open with a short ruling paragraph** — the whole verdict in one place — then answer each numbered question under its
  own `### Qn — <title>` heading, each beginning with an explicit **Ruling:** line, and **end with a section proposing
  the sub-step split** as a dependency-ordered list.
- **Cite `file:line` for every claim about existing code**, derived by you. Where you could not verify something, say so
  plainly in one line rather than asserting it.

## 7. What this brief could not establish — its own coverage bounds

1. **No gate was run for this brief.** §3's baseline figures are `PROGRESS.md`'s, re-read but not re-derived; every count
   in §3 (942 keys, ten jsdom files, seventeen commands, eight `expected`/`found` renderers, five stale hand-offs) is an
   `rg` reading of the tree on 2026-09-21, not a compiled or executed one.
2. **§3's table is a snapshot of one reading.** Every range was opened, but correct endpoints do not prove the brief
   characterized everything between them, and "has no production caller" was established by symbol search outside
   `*.test.ts` — a dynamic call through a string, or an import under `src/probe.ts` (the uncommitted instrument, which
   was excluded on purpose), would not have been seen. Re-derive any count your ruling turns on.
3. **No claim here is made about what a window does.** Ten files mount a component in an automated test and none
   mounts an external conflict, because none exists; the only screen evidence in the 2d line is 7b's, which read
   delivery and drew no surface (7b §5 item 4).
4. **Every review of the 2d-5 steps ran on Codex** — `PROGRESS.md` counts twelve consecutive Codex rounds by 2d-5-6, and
   2d-5-7a and 2d-5-7b were Codex too — and the 2d-5 consult itself was Codex at high effort. So this material has had a
   second provider throughout, and the shared prior is now Codex's rather than Opus's. **Look hardest where a reviewer
   who has approved every step of this design would nod.**
5. **This brief takes no position on any question it asks.** Where §3 or §5 reads like an answer it is quoting a shipped
   constraint; the eleven questions are open, and a ruling that overturns a 2d-5 ruling **with evidence** — item 6's
   own scope included — is a legitimate outcome, provided it says which record it overrides and why.
