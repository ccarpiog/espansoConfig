# Phase 2d-6-9b-2 — the eight write renderers' acknowledgement, and their notices handed to the pane

**Status: complete and CLOSED** — reviewed (fallback agent, `ship-with-fixes`, 0 BLOCKERS, 1 SHOULD-FIX fixed; §8).
Risk class: **high**. This is the second half of 2d-6-9b, as the orchestrator cut it on
2026-09-23 ([`2d-6-split-notes.md`](2d-6-split-notes.md) §2, the cut of 9b).

In short:
- Each of the eight write renderers now draws the uncertainty acknowledgement **on its own panel**,
  directly under the disk snapshot its conflict carries. The press runs the session's own
  `acknowledge…Snapshot` transition (`acknowledgeSnapshot` ×3, `acknowledgeDeletionSnapshot`,
  `acknowledgeMoveSnapshot`, `acknowledgeDuplicationSnapshot`, `acknowledgeRecoverySnapshot`,
  `acknowledgeRestoreSnapshot`). Before this step nothing drew any of the eight
  (`2d-6-8b-notes.md` §4 item 6 named two of them).
- The panels **no longer draw their own held and unknown-outcome notices**. The pane's
  `FileReconciliationStatus.svelte` block, above each panel, is now the one drawing of both
  sentences (§2 ruling 1 — this was found drawn twice).
- The surface wording owed by 9b-1 (`2d-6-9b-1-notes.md` §4 item 2) is written: two notes, with
  the exits a surface really has.
- The orchestrator's ruling on entry 15 is recorded (§3). **9b-3 is not implemented.**
- **No session model changed. No Rust changed.**

The eight renderers, confirmed from the code (`DetailPane.svelte` mounts seven; the recovery form is
mounted by the editor and the new-snippet form): `MatchEditor.svelte`, `MatchCreator.svelte`,
`RecoveryPanel.svelte`, `MatchDeleter.svelte`, `MatchMover.svelte`, `MatchDuplicator.svelte`,
`RawEditor.svelte`, `RestorePane.svelte`.

Abbreviations:
- `RS` — `src/lib/browser/reconciliationStatus.ts`
- `SA` — `src/lib/components/SnapshotAcknowledgement.svelte`
- `FRS` — `src/lib/components/FileReconciliationStatus.svelte`

---

## 1. What changed

| File | Change |
|---|---|
| `RS` | New values: `surfaceAcknowledgementOwed`, `decideSurfaceAcknowledgement`, `SurfaceControlNote` / `surfaceControlNoteOf` / `surfaceControlNoteKey`, and the port: `SurfaceAcknowledgementPort`, `SurfaceAcknowledgementReader`, `surfaceAcknowledgementPortOf`. `fileControlsDrawnAt`'s doc now says the surface acknowledgement is drawn |
| `SA` | **New.** The control, its disabled refusal, the surface note, and a refused press's reason. Draws no state sentence |
| The eight renderers | A required `acknowledgement: SurfaceAcknowledgementPort` prop; `acknowledgementControl` derived from the panel's own `external.source`; `acknowledgeTheSnapshot()` running the session's transition; `SA` mounted in the `comparison` snippet directly under the disk text; the `externalNotices` / `noticesBesideRefusal` loop removed; comments corrected |
| `MatchEditor.svelte`, `MatchCreator.svelte` | Also hand the port on to `RecoveryPanel` |
| `DetailPane.svelte` | Builds `surfaceAcknowledgementPortOf(browser)` once (`$derived`) and hands it to the seven top-level renderers. The header comment names the split |
| `src/lib/i18n/en.json`, `es.json` | 2 new keys each (§2 ruling 4) |
| `src/lib/i18n/codes.ts`, `index.ts` | `describeReconciliationSurfaceNote` and `tReconciliationSurfaceNote`. The docs of `tExternalConflictNotice` and `tExternalConflictAction` corrected (both now have no component caller) |
| Eight session modules | Doc comments only: each view's `externalNotices` (and, on the mover, duplicator and restore, `noticesBesideRefusal`) said a renderer drew them; corrected |
| `src/lib/browser/observationDelivery.ts` | Doc comments only, the same correction (`ExternalConflictNotice`, `noticesBesideRefusal`, `ExternalConflictAction`) |
| `src/lib/browser/fixtures.ts` | `scriptedAcknowledgement()`: a scripted port that records which source each press minted from |
| Eight renderer test files | The port handed to every mount; the old notice assertions inverted (§4); a new bilingual suite each (§4) |
| `src/lib/components/ReconciliationStatus.test.ts` | A bilingual suite over the real `BrowserState` with the raw editor open in the pane |
| `src/lib/browser/reconciliationStatus.test.ts` | 5 model cases for the new values and the port |
| `src/lib/i18n/reconciliationStatusCodes.test.ts`, `externalConflictCodes.test.ts` | The two notes in the key/wholeness checks, pinned literally, and in the forbidden-claim scan |
| `docs/decisions/2d-6-split-notes.md` | The 2d-6-9b-3 bullet (§3) |

## 2. Rulings taken here

### Ruling 1 — the panels stop drawing their own notices (the double drawing found)

The brief said the held and unknown-outcome sentences "are already drawn once above each panel by
the pane's FRS block". **Measured, they were drawn twice.** Since 2d-6-6c-1, 2d-6-7b and 2d-6-8b
every panel drew its view's `externalNotices` (or `noticesBesideRefusal`) through
`tExternalConflictNotice`, and 9b-1's `FRS` draws the same two keys at the `surface` placement.
With a panel open in the pane, both drew. 9b-1's mounted case used a registered stand-in surface,
not a real panel, so it could not see this.

The pane's drawing is kept and the panels' are removed:
- the `FRS` block reads the **window's** hold and barrier; a panel's notice reads its **session's**
  flags, which can outlive the window's hold (the gap `acknowledgeSnapshot` in `matchEditor.ts`
  states);
- `FRS` draws one sentence per file, where an editor and its recovery form over one file drew two;
- 9b-1's placement (entry 27) is the pane's, and the brief confirmed it.

A panel now reads its `externalNotices` only through `surfaceAcknowledgementOwed`. The view fields
stay (they are tested values, and removing them is a model change beyond this step's scope).

**What this does not cover** is a *refusal line* that renders one of the two sentences as its reason
(§6 item 1).

### Ruling 2 — the acknowledgement sits under the disk text the panel already draws

Every panel's `comparison` snippet already draws its conflict's whole disk text through
`SourceText … documentStart`. That text is `model.source`'s own snapshot, so `SA` is mounted
directly under it rather than drawing the file a second time under the route's heading. The control
is drawn only on the external arm (`external !== null`) and only when the session owes it.

### Ruling 3 — the port, and what "eligible" means on a surface

`surfaceAcknowledgementPortOf(browser)` has two members over **the panel's shown source**:
- `refusalFor(source)` asks `uncertaintyAcknowledgementEligibility` for the source's file. `eligible`
  gives `null` only when `standingConflictFor(file) === source`; any other standing origin is
  `superseded`, because the window would mint for an object this panel does not show. The other
  arms go through the route's own `acknowledgementMintRefusalOf`.
- `acknowledge(source)` mints with `uncertaintyAcknowledgementFor(source)` and spends; a `null`
  mint asks the eligibility reader for the reason, as the route's press does.

The session transition calls the port through its `AcknowledgeTheUncertainty` closure with
`session.externalConflict.source`, which is the object `external.source` names. So the panel mints
from `model.source` (entry 14) by construction of the session function, not by the markup. **What
nothing forces** is that a host hands the production port; `acknowledgement` is required, and that
forces only that some port is supplied.

### Ruling 4 — the surface wording states the surface's real exits

Measured on the code, not assumed:
- On a surface, the next observation is delivered to the panel. A replacing verdict gives the
  session a fresh origin, registered at the current projection generation, and a fresh
  `uncertaintyUnresolved` (`replacedBy` in each session module). That is the exit.
- A later write of this window's that ends on a named revision ends the **window's** hold but not
  the session's withheld reload. It is therefore **not** an exit on a panel: it turns
  `projectionReplaced` into `holdMoved`.

So `surfaceControlNoteOf` gives:

| Refusal of the disabled control | Note |
|---|---|
| `projectionReplaced`, `superseded` | `observationExit` |
| `holdMoved` | `holdEnded` |
| `writeInFlight` | none: its sentence already says "available once it finishes" |

New keys, EN and ES:
- `browser.reconciliation.surface.observationExit`: *"On this panel, acknowledging stays
  unavailable until a further change to this file is observed and shown here."* / *"En este panel,
  el reconocimiento seguirá sin estar disponible hasta que se observe otro cambio en este archivo y
  se muestre aquí."*
- `browser.reconciliation.surface.holdEnded`: *"On this panel, loading the version on disk stays
  unavailable until a further change to this file is observed and shown here."* / *"En este panel,
  cargar la versión del disco seguirá sin estar disponible hasta que se observe otro cambio en este
  archivo y se muestre aquí."*

Both say "until", never "when": nothing can force a further change to happen. `holdEnded` names the
reload rather than the acknowledgement because, with the window's hold gone, only a delivery clears
the session's flag. Both are in the forbidden-claim scan, and a case asserts neither names a write
or a workspace reload. **The new Spanish has had no bilingual review** (R35), like 9a's and 9b-1's.

A refused press draws its refusal once. If the re-derived control is disabled for the same reason,
the sentence is already drawn and is not repeated. A refusal about one origin is not drawn beside
the next one (`SA` keeps the source it was pressed for).

## 3. The entry-15 ruling, recorded

The orchestrator's ruling on `2d-6-9b-1-notes.md` §6 item 1, recorded verbatim in substance in
`2d-6-split-notes.md` §2 as the bullet **2d-6-9b-3**:

> Entry 15 is to be enforced on the coordinator's automatic path: while a file is under an
> uncertainty hold, an automatic reread is refused, and the refused observation is registered as an
> acknowledgeable origin, so the resulting `stale` file keeps an exit (acknowledge, then reread).
> This is model work in a bounded corrective sub-phase **2d-6-9b-3**, scheduled after 9b-2 and
> before 9c so the window reading reads the enforced behaviour; it has its own acceptance: a model
> case shown failing first for the refused reread and for the registered origin, the
> route/acknowledgement drawn for it EN and ES, and no change to the manual `requestFileReread` path.

Nothing of it is implemented here.

## 4. The mounted evidence

**One new suite per renderer**, appended to its existing jsdom file (no new test file, so no new
invoke guard is owed; the files that had one keep it). Each runs once per locale, over a scripted
port (`scriptedAcknowledgement`), and has four cases:
1. **Offered, pressed, ended.** A `raisedWithoutReload` delivery: the control is enabled and inside
   `.panel.external`, after the disk text; the panel does not draw the unknown-outcome sentence; the
   reload is withheld. The press calls the port once, **with `externalConflictSource(seen)` — the
   very object the panel shows**; afterwards the control is gone, the reload is offered again, and
   nothing was adopted.
2. **Disabled, with its exits.** For each of `projectionReplaced`, `superseded`, `holdMoved` and
   `writeInFlight`: disabled, the refusal sentence, exactly the note of §2 ruling 4 (and not the
   other), and the reload still withheld.
3. **A refused press** (`holdMoved`): its sentence drawn exactly once; the session unchanged.
4. **Nothing owed** under a plain `raised`: no control, and the reload is offered.

The recovery form is opened in English and then switched to the case's locale, because that suite's
`control` helper reads English labels.

The old notice assertions were inverted, with a comment naming this phase: the raw editor's held
reading and unknown outcome; the deleter's held question and unknown outcome; the mover's and
duplicator's reading behind a conflict and unknown outcome; restore's unknown outcome (renamed
*…and leaves the sentence to the pane*). Each unknown-outcome case also asserts the control is drawn.

**Over the real `BrowserState`** (`ReconciliationStatus.test.ts`, EN and ES). The raw editor is
opened through the pane, a raw save answers `may_have_written`, and an observation is delivered as
`raisedWithoutReload`. Then:
- the pane draws the unknown-outcome sentence **exactly once**, and not inside the panel;
- the pane has exactly one acknowledgement, and it is the panel's;
- the press ends the window's hold (`writeOutcomeUncertain(2)` is `false`), draws the reload again,
  leaves the standing origin identical, and **changes no command's call count** (entry 14).

**Model** (`reconciliationStatus.test.ts`): owed from the notices; the decision; the note mapping;
the port's prediction for a standing, a non-standing and each ineligible arm; and the port minting
from the handed source and spending that token (nothing is spent when nothing was minted).

### Shown failing against broken versions

Each broken variant was written in, the suites were run, and the file was restored and checked with
`cmp`:

| Broken version | Result |
|---|---|
| `SA` never mounted (`{#if false && …}` in all eight renderers) | **62 failed** across all eight renderer files and `ReconciliationStatus.test.ts` (4) |
| `SA` also draws the unknown-outcome sentence (a second drawing) | **28 failed**, in all eight files and both pane cases. EN: `expected [ '  ', …(2) ] to have a length of 2 but got 3` |
| The port mints from the window's standing origin instead of the handed source, **and** `holdMoved` maps to `observationExit` | **18 failed**: the two model cases, and every renderer's "disabled" case in both locales |

For the third row, the "mints from the very source" model case was changed **before** the run: as
first written, its reader's standing origin *was* the handed source, so a port minting from the
standing origin would have passed it (reasoned, not run). The reader now answers another object,
and against the broken port the case failed as listed.

## 5. What none of this shows

A window. Where the control lands on screen, whether it sits under the fold below a long disk text,
and how the pane's sentence and the panel's control read together are 2d-6-9c's reading. It should
also read the refusal lines of §6 item 1.

## 6. Open items (not fixed here, `CLAUDE.md` §7)

1. **Refusal lines still render the held or unknown-outcome sentence as their reason.** Five
   submission refusals render `observationRetained` through `externalConflictNoticeKey`:
   `moveSubmissionRefusalKey`, `duplicationSubmissionRefusalKey`, `restoreRefusalKey`,
   `creationRefusalKey` and `recoveryRefusalKey`. So with a held reading, those panels' refusal line and the
   pane's block say the same sentence. `RestorePane.test.ts` still asserts the refusal line contains
   it. The reapply-obstacle keys of six sessions render both sentences the same way (drawn only
   after a reapply attempt, which neither state offers). Changing a refusal's wording is a
   dictionary decision across five session modules. It is outside "the renderers' status and
   acknowledgement presentation", so it is recorded for 2d-6-11's bilingual pass or a small
   corrective step.
2. **Values nothing draws any more:** the `noticesBesideRefusal` view fields (mover, duplicator,
   restore) and `noticesBesideRefusal` in `observationDelivery.ts`; `tExternalConflictNotice` /
   `describeExternalConflictNotice`; `tExternalConflictAction` / `describeExternalConflictAction`.
   Their docs now say so. Deleting them is a model/i18n change for a later step.
3. **The session-side dead end is now drawn, not closed.** When the window's hold ends by another
   exit (a later definite write, `open()`), a panel still withholds its reload until the next
   observation reaches it (the `acknowledgeSnapshot` gap). The panel now says exactly that
   (`holdEnded`). Closing it would need a model change: a delivery of "hold ended" to the sessions,
   or a closure answering `acknowledged` on `noHold`. Neither is taken here.
4. **2d-6-9b-3** (§3) — model work, next.
5. **Carried unchanged:** 9b-1 §6 items 3-4 (9c's reading, including the retry-enabled state; the
   bilingual review of 9a's and 9b-1's Spanish, now joined by this step's two sentences); 9b-1 §8.3's
   release-path sequence; `2d-6-8c-notes.md` §4 items 1-3 and 5-8.

## 7. Verification

Each gate was run on its own, with its output redirected to a file and read from that file. The tree
includes the uncommitted instrument. No Rust changed, so no Cargo gate is owed.

| Command | Exit | Evidence |
|---|---|---|
| `npm test` | 0 | **3357 passed**, 69 files |
| `npm run check` | 0 | **457 files**, 0 errors, 0 warnings |
| `npm run build` | 0 | **200 modules** |
| `rg -c '\$\$payload\|head_payload\|push_element' dist/assets/index-*.js` | 1 | nothing found (server-only oracle absent) |
| `rg -c 'window\.__svelte\|svelte-trusted-html' dist/assets/index-*.js` | 0 | `2` (client-only oracle present) |
| `git diff --stat src-tauri/src/main.rs src/main.ts` | 0 | `5 insertions(+), 1 deletion(-)`, unchanged |

**New rung: `1323 / 457 / 3357 / 200`**, with the instrument in the tree (previous
`1323 / 456 / 3280 / 198`).

| Figure | Change | Per file |
|---|---|---|
| Rust tests | unchanged | no Rust touched |
| svelte-check files | +1 | `SnapshotAcknowledgement.svelte` (no new `.ts` file; the helpers went into `fixtures.ts`) |
| vitest tests | +77 | See below |
| Vite modules | +2 | one new styled component, `SA`. `RS` was already in the bundle, and `fixtures.ts` is test-only |

The +77 vitest tests are:
- the eight renderer suites: 4 cases × 2 locales × 8 = **+64**;
- `ReconciliationStatus.test.ts`: 2 cases × 2 locales = **+4**;
- `reconciliationStatus.test.ts`: **+5**;
- `reconciliationStatusCodes.test.ts`: **+1** (the pinned notes);
- the per-component lint rows for the one new component: `scripts/lint/ipc-detail.test.ts`,
  `hardcoded-strings.test.ts` and `built-translation-keys.test.ts`, **+1 each (+3)**.

That sums to 77, matching the measured total. The per-file split of the lint rows follows 9b-1's
accounting (one row per new component in each), and was not re-measured with the JSON reporter.

Only read-only git commands were run. There was no commit and no stash, `PROGRESS.md` and
`PROGRESS.json` were not edited, and none of the four instrument paths was touched.

## 8. Review and fix

`autoclaude-review.sh` exited 2 (`REASON=usage-limit`: Codex's usage limit), so the fallback agent
`autoclaude-reviewer` (opus) wrote [`docs/reviews/phase-2d-6-9b-2.md`](../reviews/phase-2d-6-9b-2.md):
**`ship-with-fixes`, 0 BLOCKERS, 1 SHOULD-FIX.**

- **SHOULD-FIX — `MatchEditorView.externalNotices`' doc comment in `src/lib/browser/matchEditor.ts`
  contradicted itself**, saying the codes are "rendered through `tExternalConflictNotice`" beside a
  sentence saying no renderer draws them. Re-derived: `rg -n tExternalConflictNotice src --glob '*.svelte'`
  finds nothing. Fixed in the comment only (it now says no component calls the accessor). `npm run check`
  re-run: exit 0, 457 files, 0 errors, 0 warnings. No other file changed in the fix.
- The reviewer's NOT-VERIFIED items (the seven other mounted suites, the production port's coverage in
  `ReconciliationStatus.test.ts`, the `$derived` reactivity of the `projectionReplaced` refusal, fresh-origin
  registration per delivery) are carried to 2d-6-9c's window reading as things it should look at, not as
  findings.
