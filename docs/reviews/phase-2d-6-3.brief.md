# Review brief — Phase 2d-6-3

**Repository:** `/Users/ccarpio/Developer/Utils/espansoConfig` (macOS Tauri v2 app; Rust core +
`src-tauri/` + Svelte 5 / TypeScript frontend; Vitest). Review the **uncommitted** working tree.

**Write your report to:** `docs/reviews/phase-2d-6-3.md` (overwrite it).

**Time budget:** 15 minutes.

---

## The phase and its goal

Phase **2d-6-3 — creation and recovery external sessions** is the third of the eleven 2d-6 steps
(`docs/decisions/2d-6-split-notes.md` §2, lines 105-112) and the first that reuses what 2d-6-2 placed
in `src/lib/browser/reapply.ts`. It gives the **creator session** (`src/lib/browser/matchCreation.ts`,
cited `C:` below) and the **recovery session** (`src/lib/browser/recovery.ts`, cited `V:`; it holds
`RecoveryOrigin` — the plan said `restore.ts`, which is the *restore* surface, a different thing) the
same external-conflict session shape 2d-6-2 gave the editor: conflict storage beside the outcome,
the submission block at every door, the seven-arm receiver, held deliveries in arrival order, and
reapply through `reapply.ts`'s primitives. Two rulings are new to this step: **21** (a
destination-less creator keeps its fields and wildcard protection, shows the affected file's state,
and **requires an explicit destination** — never adopts the observed file or retargets silently) and
**25** (`RecoveryOrigin.conflict` retains the **exact originating source object**, never replaced by
the destination's conflict nor spent to adopt it; the recovery form has its own external-conflict
session independent of that reference). §5.1 of the record makes recovery the **eighth** live write
surface: this step delivers the **values** a recovery form reports upward (`recoveryTargetOf`,
`creationTargetOf`); the `DetailPane` assembly is 2d-6-6's. **Components: none. No Rust change. No new
module. No i18n key added.** The binding rulings are §3 entries **6, 7, 8, 9, 11, 12, 19, 20, 21, 22,
25** (lines ~229-340). The phase's record is `docs/decisions/2d-6-3-notes.md` (§1 what changed with
`file:line`, §2 rulings, §3 inherited items, §4 open items, §5 verification). The worker claims:

1. **Four fields on each session** — `externalConflict` (`C:684`, `V:1070`), `uncertaintyUnresolved`,
   `awaitingReconciliation`, `heldDeliveries: readonly ObservationDelivery[]` (`C:732`, `V:1109`);
   `conflictOf` (`C:884`) and `recoveryConflictOf` (`V:1365`) widened to `ConflictModel` (external
   first). Views gain `externalMessages`, `externalNotices`, `destinationRequired`,
   `canChooseDestination` (`C:2546-2574`, `V:2984-3004`), read by no component.
2. **Submission block at every door** — `CreationRefusal` (`C:1242`) and `RecoveryRefusal` (`V:1656`)
   gain `externalConflict` and `observationRetained` (reusing existing sentences, no new key);
   `beginCreate` (`C:1423`) / `beginRecoveryCreate` ask the refusal function first and answer `null`.
3. **`applyObservation` (`C:1825`) / `applyRecoveryObservation` (`V:2442`)** — seven arms with a
   `never` terminus; the private `replacedBy` (`C:1879`, `V:2493`) retires a save conflict and resets
   `reload`; `writtenHere` lifts by identity; while `phase === 'saving'` envelopes append to
   `heldDeliveries`, replayed first-to-last by `applyCreate` (`C:1488`), `createCouldNotBeSent`
   (`C:1580`), `applyRecoveryCreate` (`V:1859`), `recoveryCreateCouldNotBeSent` (`V:1991`).
4. **Ruling 21** — a destination-less form keeps `chosen === null`, the draft's base `''`, both
   typed values; `creationTargetOf` (`C:2939`) / `recoveryTargetOf` (`V:3159`) keep answering
   `{ kind: 'unknown' }`; reload and reapply are withheld under a `destinationRequired` obstacle;
   only `chooseDestination` (`C:1033`) resolves it, gated by `canChooseDestination` (`C:949`), which
   is **wider than `isEditable` by exactly that state**.
5. **Reapply through `reapply.ts`** — `anchorResolution` (`R:956`), the one primitive widened
   (`subjectResolution`'s twin over the four-arm `ReapplyResolution`); `reapplyToDiskVersion(session,
   adopt, standing = null)` (`C:2334`) through `enterReapply` with the private `unaskedGuard`
   (`C:2260`); the private `rebuiltPlacement` (`C:2172`) over `ReapplyEvidenceAccess` — an `after`
   anchor read by full base identity through `correspondenceRowFor`; `front` / `end` and recovery
   consult no table.
6. **Ruling 25** — `RecoveryOrigin.conflict` (`V:899`) written once by `openedRecovery`, read by
   nothing that adopts; pinned in `recovery.test.ts:1966` and through the real window in
   `workspace.test.ts:10429` (cross-file recovery over `match/other.yml` beside a host editor over
   `match/base.yml`).
7. Entry 41 comment corrections in `conflictSource.ts`, `observationDelivery.ts`, `saveOutcome.ts`,
   `restore.ts` (the last: `OpenWriteSurfaceKind` has seven members and is not complete).

## Changed files (`git diff --stat`, instrument paths excluded)

```
src/lib/browser/matchCreation.ts       | 1027 +++-
src/lib/browser/matchCreation.test.ts  |  931 +++-   (69 → 95 cases)
src/lib/browser/recovery.ts            |  852 +++-
src/lib/browser/recovery.test.ts       |  683 +++-   (74 → 88)
src/lib/browser/reapply.ts             |   51 +-
src/lib/browser/reapply.test.ts        |   32 +     (37 → 38)
src/lib/browser/workspace.test.ts      |  432 +     (296 → 302)
src/lib/i18n/index.ts                  |   26 +
src/lib/i18n/reapplyCodes.test.ts      |    9 +-    (20 → 20)
src/lib/browser/conflictSource.ts      |    7 +-    (comment-only, entry 41)
src/lib/browser/observationDelivery.ts |   16 +-    (comment-only)
src/lib/browser/saveOutcome.ts         |   11 +-    (comment-only)
src/lib/browser/restore.ts             |   10 +     (comment-only)
docs/decisions/2d-6-3-notes.md         | new
```

**Four paths are deliberately dirty and are NOT part of this phase**: `src-tauri/src/main.rs`,
`src/main.ts`, `src-tauri/src/probe.rs`, `src/probe.ts` — the temporary window-reading instrument
(`CLAUDE.md` §6). `PROGRESS.json` is the orchestrator's in-flight marker. Ignore all five. **Never run
`git stash` or any mutating git command.**

## Verification the orchestrator ran on this tree (each alone, exit 0, read directly)

- `npm run check` → exit 0, `447 FILES 0 ERRORS 0 WARNINGS`.
- `npm test` → exit 0, `64 passed (64)` files, `2665 passed (2665)` tests (from 2618, +47).
- `npm run build` → exit 0, `192 modules transformed` (unchanged); server-only markers absent
  (`rg -c '\$\$payload|head_payload|push_element' dist/assets/index-*.js` prints nothing), client-only
  present (2).
- Rust untouched: no path under `src-tauri/` or `crates/` changed beyond the instrument's hook line
  (`git diff --stat` over the pair still `5 insertions(+), 1 deletion(-)`).

## Where to attack — the risks, in order

**A green suite is not proof here**; both blockers 2d-6-2's review found (a rebuild dropping
`awaitingReconciliation`; a single-slot hold losing a `raised` behind a later `coalesced`) were of a
shape no gate could catch. Re-derive, do not re-read.

1. **The submission block at every door (entry 8), on two modules this time.** Enumerate every exit
   from each session that reaches a command — `beginCreate` / `beginRecoveryCreate`, the
   acknowledgement path (*Create anyway* over findings), the reapply's adoption, the reload,
   `chooseDestination` — and confirm each asks the refusal predicate **after** the last
   caller-controlled read. Is there a path where an external conflict or a held reading is populated
   but a send proceeds — e.g. an acknowledgement panel built before the observation arrived, then
   confirmed? Does `chooseDestination` under an external conflict spend anything?
2. **Every rebuild carries `awaitingReconciliation` forward.** 2d-6-2's first blocker was exactly
   this. List every function in `C` and `V` that constructs a new session object from an old one
   (`chooseDestination`, `editField`, `applyCreate`, `createCouldNotBeSent`, the reapply's success
   arms, `acknowledgeSnapshot`, the recovery equivalents, `replacedBy`) and check each one copies —
   or deliberately resets, with a reason — `awaitingReconciliation`, `uncertaintyUnresolved`,
   `externalConflict` and `heldDeliveries`. A spread from the old session is fine; a hand-built
   literal that omits one is a blocker.
3. **Held deliveries: the hold is released on every exit of the save**, and replay order. Is
   `heldDeliveries` replayed on committed, refused, rejected **and thrown**? Can a replay itself
   re-enter the `saving` phase and hold again, losing the tail? Does a replayed `writtenHere` for
   the session's *own* write lift a wait recorded for a **different** observation? What happens to
   a held list when `chooseDestination` changes the file mid-save (is that even reachable)?
4. **Ruling 21 — the destination-less form.** Build the order by hand: form open with `chosen ===
   null` → `raised` over file A arrives (how does an observation reach a form that names no file?
   over which files is it registered — the notes say undecided; check the model does not *silently*
   pick one) → the person chooses file B. Is the external conflict recorded over A still shown
   after choosing B (a stale conflict over a file no longer the target), or is it dropped (losing
   evidence)? Either may be defensible; a **silent** answer is not. Does `canChooseDestination`
   being wider than `isEditable` let anything else through — is it read by any predicate other than
   `chooseDestination`?
5. **Ruling 25 — `RecoveryOrigin.conflict` never spent.** Trace every read of `session.origin` in
   `V`: is any read used as an operand to `adoptDiskVersion`, `enterReapply`, the acknowledgement
   or `reapplyToDiskVersion`? The claim is "read by nothing that adopts" — verify by enumeration,
   not by the test. When the recovery form writes back into the origin's own file, the destination
   conflict and the origin conflict are over the same file: does any code path confuse them by
   comparing on `document`/`revision` rather than object identity?
6. **`anchorResolution` (`R:956`) and `rebuiltPlacement` (`C:2172`).** Check-and-spend: is the row's
   resolution read exactly once, and after the "exactly one row" check? An `after` anchor whose row
   resolves `notAnchored` — does the rebuilt placement refuse, or fall back to `end` silently
   (which would relocate the snippet)? A `front`/`end` placement "asks the evidence nothing" — does
   it still refuse under `superseded` evidence, as the notes claim?
7. **`writtenHere` by identity.** What identity — the `ObservationDelivery` object or the
   `ConflictSource`? Same question as 2d-6-2's risk 2: can a `writtenHere` for observation A lift
   the wait recorded for B? Confirm the arm changes **nothing else** in both modules.
8. **One conflict active (entry 7), the replacing reset (entry 12), on the recovery form.** Save
   conflict standing → `raised`; `raised` → `supersedes`; `coalesced` over a shown external. After
   each, exactly one of `externalConflict` / the outcome's conflict arm is populated, `reload` is
   reset, and the **typed values and the origin survive**.
9. **Doc claims versus code** (`CLAUDE.md` §5). Every new doc comment in `C`, `V`, `R`, `index.ts`:
   does it claim a guarantee the code does not give? The notes say "nothing in either module writes
   `chosen` but the destination transition" — grep it. The entry 41 corrections in the four
   comment-only files — is each sentence now true?
10. **The test discipline of rulings 34/35** (2d-5 record). The command spy at exactly zero through
    every session transition in the six new `workspace.test.ts` cases; any scripted reload uses an
    exact drain budget; `drainsUnscripted` asserted zero; every started coordinator disposed; no
    write lease left open. A new case asserting `toHaveBeenCalled()` without an argument, or leaving
    a lease open, is a finding.
11. **The record** (`2d-6-3-notes.md`): §5 claims five mutation checks; spot-check two that the named
    test fails against the described pre-change shape; spot-check three `file:line` citations.

## What NOT to spend budget on

- Whether the eight remaining sub-steps 2d-6-4 … 2d-6-11 should be cut differently.
- The four instrument paths and `PROGRESS.json`.
- The fifteen corpus fixtures.
- Spanish prose (no key was added; ruling 40's bilingual review is 2d-6-11's).
- Style: JSDoc presence and closing-bracket comments are the worker's discipline; only flag a
  **false** comment, not a missing one.
- The open items the record's §4 already admits, unless one is a defect the record mislabels as a
  deliberate gap — the `MatchCreator.svelte` gating of the destination control on `editable` is
  admitted as 2d-6-6's; do not re-find it.

## Report format

Overwrite `docs/reviews/phase-2d-6-3.md`. End with the verdict lines the reviewer definition
requires (`ship` / `ship-with-fixes` / `do-not-ship`; counts of BLOCKERS and SHOULD-FIX). For every
finding give `file:line`, the concrete input or interleaving that breaks it, and what the fix should
do — never just "consider". Say explicitly when a suspected finding was checked and **did not hold**.
