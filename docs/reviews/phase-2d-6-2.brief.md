# Review brief — Phase 2d-6-2

**Repository:** `/Users/ccarpio/Developer/Utils/espansoConfig` (macOS Tauri v2 app; Rust core +
`src-tauri/` + Svelte 5 / TypeScript frontend; Vitest). Review the **uncommitted** working tree.

**Write your report to:** `docs/reviews/phase-2d-6-2.md` (overwrite it).

**Time budget:** 15 minutes.

---

## The phase and its goal

Phase **2d-6-2 — match-editor external session and reapply** is the second of the eleven 2d-6
steps (`docs/decisions/2d-6-split-notes.md` §2, lines 96-103) and the first that consumes what
2d-6-1 landed on `BrowserState`. It gives the match-editor session (`src/lib/browser/matchEditor.ts`)
its external-conflict field, the submission block at `canSave` and `beginSave`, the receiver that
switches over all seven observation-verdict arms, the replacing verdict's reset, and the external
correspondence lookup for reapply by full base identity. **Components: none. No Rust change. No new
module.** The rulings that bind it are the record's §3 entries **6, 7, 8, 9, 11, 12, 19, 20, 22**
(lines ~229-330), plus 1b's seventh verdict arm `writtenHere` (`docs/decisions/2d-6-1b-notes.md`
§1.5); rulings 34/35 of `docs/decisions/2d-5-split-notes.md` govern the drain-budget test
discipline. The phase's own record is `docs/decisions/2d-6-2-notes.md` (§1 what changed with
`file:line`, §2 eight rulings the worker took, §3 verification, §4 eleven open items). The worker
claims to have delivered:

1. **`MatchEditorSession.externalConflict: ExternalConflictModel<MatchBuffers> | null`**
   (`matchEditor.ts:768`) beside `outcome`, plus three more session fields —
   `uncertaintyUnresolved`, `awaitingReconciliation`, `heldDelivery`; `conflictOf` widened to
   `ConflictModel` (`:1228`, external first, then the outcome's conflict arm); `startMatchEditor`
   seeds all four inert. The view gains `externalMessages` and `externalNotices` (`:2904`, `:2916`),
   read by no component yet.
2. **`canSave` (`:1514`) and `beginSave` (`:1590`)** refuse under a conflict of either origin and
   under a held observation; `beginSave` called directly answers `null`. `refusalChoices` (`:3089`)
   withholds `saveAnyway` under either external block.
3. **`applyObservation(session, delivery)` (`:2049`)** — the receiver as a value: a `switch` over
   `delivery.verdict.kind` with a `never` terminus, seven arms; `writtenHere` lifts the wait **by
   the observation's identity**; a replacing verdict retires a standing save conflict, resets
   `reload`, clears confirmations and invalidates displayed reapply results (entries 7, 12);
   `keepEditing` erases no block (entry 9). **Uncommissioned**: deliveries arriving during the
   session's own in-flight save are **held** on the session (`heldDelivery`, the worker's reading
   of ruling 5 — record §2 item 1) and a new `acknowledgeSnapshot` rebuilds reload/reapply after the
   window's acknowledgement (§1.5, `raisedWithoutReload`).
4. **Reapply over both origins**: in `src/lib/browser/reapply.ts`, `enterReapply` (`:406`),
   `CorrespondenceRowRefusal` folded into `ExternalEvidenceRefusal` (`:447`, `:465`),
   `correspondenceRowFor(table, base)` (`:800`, document + revision + node compared, captured once,
   zero rows and two rows both refuse) and `subjectResolution` (`:883`); in `matchEditor.ts`,
   `reapplyToDiskVersion(session, adopt, standing = null)` (`:2634`) with the private
   `subjectOfEvidence` (`:2712`) over four access arms, three new `EditorReapplyObstacle` arms, and
   the private `unaskedGuard` (`:2689`) that an **omitted** guard becomes. **Deviation**: the
   standing-origin guard is an **optional third parameter** because the component calls with two and
   may not be touched this phase; omitted, the supersession question is not asked and
   `adoptDiskVersion` refuses at the door as `adoptionRefused` (§2 item 3, §4 item 4).
5. **Two new i18n keys** (`browser.reapply.externalEvidence.noRowForBase` / `.severalRowsForBase`,
   EN + ES) and the **register review**: the four umbrella `browser.reapply.*` sentences and the two
   success arms `reapplied` / `alreadySatisfied` reworded so none claims "nothing was written" after
   an uncertain write; `src/lib/i18n/index.ts`'s `describeEditorReapplyObstacle` (`:1610`) is now a
   `switch` with a `never` terminus over seven arms. Entry 41 comment corrections in four files.

## Changed files (`git diff --stat`, instrument paths excluded)

```
src/lib/browser/matchEditor.ts             |  791 +++-
src/lib/browser/matchEditor.test.ts        |  805 +++-   (101 → 126 cases)
src/lib/browser/reapply.ts                 |  265 ++-
src/lib/browser/reapply.test.ts            |  232 ++-   (29 → 37)
src/lib/browser/workspace.test.ts          |  361 ++-   (288 → 294)
src/lib/browser/workspace.svelte.ts        |    7 +-    (comment-only, entry 41)
src/lib/browser/observationDelivery.ts     |   22 +-    (comment-only)
src/lib/browser/conflictSource.ts          |   10 +-    (comment-only)
src/lib/browser/saveOutcome.ts             |   18 +-    (comment-only)
src/lib/i18n/index.ts                      |   69 +-
src/lib/i18n/en.json                       |   14 +-
src/lib/i18n/es.json                       |   14 +-
src/lib/i18n/externalConflictCodes.test.ts |   50 +-    (21 → 22)
docs/decisions/2d-6-2-notes.md             | new, 333 lines
```

**Four paths are deliberately dirty and are NOT part of this phase**: `src-tauri/src/main.rs`,
`src/main.ts`, `src-tauri/src/probe.rs`, `src/probe.ts` — the temporary window-reading instrument
(`CLAUDE.md` §6). `PROGRESS.json` is the orchestrator's in-flight marker. Ignore all five.

## Verification the orchestrator ran on this tree (each alone, exit 0, read directly)

- `npm run check` → exit 0, `447 FILES 0 ERRORS 0 WARNINGS`.
- `npm test` → exit 0, `64 passed (64)` files, `2614 passed (2614)` tests (from 2574).
- `npm run build` → exit 0, `192 modules transformed` (unchanged); server-only markers absent
  (`rg -c '\$\$payload|head_payload|push_element' dist/assets/index-*.js` prints nothing), client-only
  present (2).
- Rust untouched: no path under `src-tauri/` or `crates/` changed beyond the instrument's hook line.

## Where to attack — the risks, in order

**A green suite is not proof here**; every blocker 2d-5-5b, 2d-6-1b and 2d-6-1c found was of a shape
no gate could catch. Re-derive, do not re-read.

1. **The submission block is a model rule at every door (entry 8).** Enumerate every exit from the
   session that reaches a command — `beginSave`, `acknowledgeFindings` / *Save anyway*, the
   reapply's adoption, any retry — and confirm each asks `canSave` (or the same predicate) **after**
   the last caller-controlled read. Is there any path where a held observation or an external
   conflict is populated but a send still proceeds (e.g. `acknowledgeFindings` on a refusal panel
   built before the observation arrived)? Does anything read `session.externalConflict` and then act
   on a **different** session object?
2. **`writtenHere` lifts by identity (entry 11 + 1b §1.5).** What identity — the `ObservationDelivery`
   object, its `sequence`, or the `ConflictSource`? Can a `writtenHere` for observation A lift the
   wait recorded for observation B (same file, later sequence)? Can a hostile `sequence` getter or a
   re-used envelope object defeat it? Does the arm truly change **nothing else** (no `reload` reset,
   no confirmation clearing)?
3. **One conflict active (entry 7) and the replacing verdict's reset (entry 12).** Build the orders by
   hand: save conflict standing → `raised`; external standing → save refusal arrives; `raised` →
   `supersedes` → `writtenHere`; `coalesced` over an already-shown external. After each, exactly
   one of `externalConflict` / `outcome`'s conflict arm is populated, `reload` is reset, displayed
   reapply results are gone, **and** field intent and save history survive (`fieldIntent` over the
   baseline and buffers gives the same answer before and after). Does `coalesced` — which the
   ruling says replaces the model — clear a reapply result the user was reading?
4. **The uncommissioned hold (`heldDelivery`, record §2 item 1).** 1b already publishes settlement
   from the write lease's `close()` and arbitrates in `BrowserState` before delivery. Does holding a
   delivery on the session **during its own save** double-handle anything 1b already decided — can
   a `writtenHere` settlement be held and then applied after a later `raised`, re-ordering what
   `deliver`'s synchronous drain queue ordered? `heldDelivery` keeps only the latest envelope (§4
   item 7): name a two-envelope interleaving where the dropped one mattered, or confirm none exists.
   Is the hold released on **every** exit of the save (committed, refused, rejected, thrown)?
5. **Check-and-spend in `correspondenceRowFor` and `subjectOfEvidence`.** The three identity
   operands are claimed captured once before the loop and each row's `base` read once. Verify in
   the code: is `row.base.document` / `.revision` / `.node` read once each, or re-read after the
   comparison? Is the found row's `editor` read once and after the count check? Can a table whose
   rows are getters change the answer between the "exactly one" check and the read?
6. **The optional guard (`unaskedGuard`, `:2689`).** The component still calls
   `reapplyToDiskVersion(session, adopt)`. With the guard omitted, does reapply **ever** obtain
   adoption without asking whether the standing origin was superseded — entry 22 forbids obtaining
   adoption internally under unresolved uncertainty, and entry 26 of the 2d-5 record ties adoption to
   the standing origin. The record says the omitted guard "refuses at the door as `adoptionRefused`":
   check that is what the code does on **both** origins, and that the doc comment does not claim
   more than an optional parameter can force.
7. **`refusalChoices` withholding `saveAnyway` (`:3089`).** Under an external block the panel keeps
   `keepEditing`. Is the findings list still current, and does `acknowledgeFindings` on the
   remaining choice reach a send (see risk 1)? Does withholding a choice change the exact-multiset
   acknowledgement contract of `save_match`?
8. **Doc claims versus code** (`CLAUDE.md` §5). Every new doc comment in `matchEditor.ts`,
   `reapply.ts` and `index.ts`: does it claim a guarantee the code does not give? The
   `externalConflict` field's doc says "only the transitions keep them exclusive" — is that true of
   every producer in the module (`applyObservation`, the save outcome installer, `acknowledgeSnapshot`,
   `keepEditing`, `adoptDiskVersion`'s installer)? The entry 41 corrections in the four
   comment-only files — is each sentence now true?
9. **The register review (i18n).** The six reworded sentences and the two new keys: EN and ES both
   present, placeholders agree, and no sentence now claims something false in the *other* direction
   (a `reapplied` sentence that no longer says the disk version was adopted when it was). Check the
   `index.ts` sentence that was corrected.
10. **The test discipline of rulings 34/35.** The command spy at exactly zero through every session
    transition in the new `workspace.test.ts` cases; any scripted reload uses an exact drain budget
    and cursor; `drainsUnscripted` asserted zero file-wide; every started coordinator disposed; no
    write lease left open by a new case. A new case asserting `toHaveBeenCalled()` without an
    argument, or leaving a lease open, is a finding.
11. **The record** (`2d-6-2-notes.md`): §3 claims four behaviour changes to existing functions were
    mutation-checked — spot-check two that the named test fails against the described pre-change
    shape; spot-check three `file:line` citations.

## What NOT to spend budget on

- Whether the nine remaining sub-steps 2d-6-3 … 2d-6-11 should be cut differently.
- The four instrument paths and `PROGRESS.json`.
- The fifteen corpus fixtures.
- Spanish prose quality (ruling 40's bilingual review is 2d-6-11's); check ES presence and
  placeholder agreement only.
- Style: JSDoc presence and closing-bracket comments are the worker's discipline; only flag a
  **false** comment, not a missing one.
- The open items the record's §4 already admits (items 1-3, 5-7, 9-11), unless one is a defect the
  record mislabels as a deliberate gap.

## Report format

Overwrite `docs/reviews/phase-2d-6-2.md`. End with the verdict lines the reviewer definition
requires (`ship` / `ship-with-fixes` / `do-not-ship`; counts of BLOCKERS and SHOULD-FIX). For every
finding give `file:line`, the concrete input or interleaving that breaks it, and what the fix should
do — never just "consider". Say explicitly when a suspected finding was checked and **did not hold**.
