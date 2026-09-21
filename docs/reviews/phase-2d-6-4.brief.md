# Review brief — Phase 2d-6-4

**Repository:** `/Users/ccarpio/Developer/Utils/espansoConfig` (macOS Tauri v2 app; Rust core +
Svelte/TypeScript frontend). Review the **uncommitted working tree** against `HEAD` (`ae81a27`).

**Write your report to:** `docs/reviews/phase-2d-6-4.md` (overwrite it).

**Time budget:** 15 minutes.

This is the phase's one adversarial review. Blockers found here are fixed and the phase closes; there
is no second round, so a finding this review does not name ships.

## The phase and its goal

**2d-6-4 — operation-session external conflicts.** The three *operation sessions* — delete
(`src/lib/browser/matchDeletion.ts`), duplicate (`matchDuplication.ts`) and move (`matchMove.ts`) — gain
the external-observation session protocol 2d-6-2 gave the match editor and 2d-6-3 gave the creator
and the recovery form. **Model only: no component, no Rust, no new module, no new i18n key.**

The record's §2 entry (`docs/decisions/2d-6-split-notes.md:114-120`), binding: *"Delivers the delete,
move and duplicate transitions, the `exact` subject and anchor lookup, pending-confirmation withdrawal
and model-owned restrictions; D2r and R25 unchanged. Acceptance: model tests over stale full
identities, ambiguous correspondence, same-sequence checks, and direct calls to `confirmDelete`,
`refusalGiven` and the duplicate boundary under an external conflict. Components: none. Bound by
entries 6-9, 11, 12, 19, 20, 22."* The rulings are in the record's §3; read **6, 7, 8, 9, 11, 12, 19,
20, 22** verbatim. The phase record is `docs/decisions/2d-6-4-notes.md` (§1 what changed with line
numbers, §2 rulings taken and what each does not force, §3 acceptance pinned, §4 open items admitted,
§5 verification, §6 where it is thin). The shape being copied is `matchCreation.ts` / `recovery.ts`
as 2d-6-3 left them (`docs/decisions/2d-6-3-notes.md` §1), and the shared primitives are in
`src/lib/browser/reapply.ts` (`enterReapply`, `correspondenceRowFor`, `subjectResolution`,
`anchorResolution` — **not widened** this phase).

Two patterns from 2d-6-3's fix round were handed to this step: (a) a session captured before an
`await` is never the one settled; (b) `awaitingReconciliation` is a `ReadonlyMap<DocumentId,
ExternalConflictObservation>` keyed by file. The record's §1.6 says (a) was **left**, arguing none of
the three modules composes a send (the components settle their live session after their own
`await`) — check whether that argument holds for every settling transition, including the three
`*CouldNotBeSent`.

## Changed files (`git diff --stat`, instrument paths excluded)

```
src/lib/browser/conflictSource.ts        |    6 +-   (entry 41 doc corrections)
src/lib/browser/matchDeletion.test.ts    |  784 ++++
src/lib/browser/matchDeletion.ts         |  844 ++++
src/lib/browser/matchDuplication.test.ts |  738 ++++
src/lib/browser/matchDuplication.ts      |  860 ++++
src/lib/browser/matchMove.test.ts        |  938 ++++
src/lib/browser/matchMove.ts             | 1003 ++++
src/lib/browser/observationDelivery.ts   |   18 +-   (doc corrections)
src/lib/browser/reapply.ts               |   17 +-   (doc corrections)
src/lib/browser/saveOutcome.ts           |   11 +-   (doc corrections)
src/lib/browser/workspace.test.ts        |  334 ++++ (window-fed cases through the real door)
src/lib/i18n/index.ts                    |   64 +-   (four new obstacle arms per surface in the describers, `never` termini)
src/lib/i18n/reapplyCodes.test.ts        |   32 +-
docs/decisions/2d-6-4-notes.md           (new)
```

**Four paths are deliberately dirty and are NOT part of this phase**: `src-tauri/src/main.rs`,
`src/main.ts` (modified), `src-tauri/src/probe.rs`, `src/probe.ts` (untracked) — the temporary
window-reading instrument. `PROGRESS.json` is the orchestrator's in-flight marker. Ignore all five.

## Verification the orchestrator ran on this tree (each alone, exit 0, read directly)

- `npm run check` — 447 files, 0 errors, 0 warnings.
- `npm test` — 2739 passed, 64 files (from 2669: `matchDeletion` 39→60, `matchDuplication` 51→72,
  `matchMove` 78→102, `workspace` 303→307, `reapplyCodes` 20→20; `ipc-detail` 141→141).
- `npm run build` — 192 modules; server-only markers absent, client-only markers present (2).
- No Rust file changed; the Rust cell is held at 1323. No file under `src/lib/components/`, no change to
  `en.json`/`es.json`.

## Where to attack — the risks, in order

**A green suite is not proof here.** Every blocker the last three reviews found (2d-6-1b, 1c, 2, 3) was
an interleaving or a stale-capture no gate could catch. Attack these, in order:

1. **The doors (ruling 8).** `canRequestDelete` / `requestDelete` / `confirmDelete`; `refusalGiven` in
   the mover and the duplicator, and `beginMove` / `beginDuplicate` through it. Is the external block
   (external conflict, a retained delivery under the session's file key, unresolved uncertainty) asked
   **after the last caller-controlled read** (a `projected` / `views` property read, a row iteration)?
   Can a getter on a caller-supplied object run between the check and the spend? Does any door still
   answer through a path that never consults the four fields?
2. **The replay queue.** `heldDeliveries` replayed after `applyDeletion` / `applyDuplication` /
   `applyMove` and the three `*CouldNotBeSent`. Is a delivery that arrives during the operation's own
   command applied to the session the caller **holds after** the answer, or to one captured before?
   Is arrival order preserved end to end? Can a replay drop an entry, apply one twice, or replay a
   `retained` against a file key the session has since left?
3. **Pending-confirmation withdrawal (ruling 12) and its inverse (ruling 9).** A replacing verdict
   (`raised`, `raisedWithoutReload`, `supersedes`) must clear a pending delete confirmation, reset
   `reload`, retire a standing save conflict and invalidate displayed reapply results; `coalesced`
   must preserve confirmation state and source identity; `notLater` must change nothing;
   `writtenHere` must lift **only** by the observation's identity. Then the dismissal: does any
   dismiss/cancel transition on any of the three sessions set the external block or the retained
   wait to null?
4. **The `exact` lookup (rulings 19, 20, 22).** Subject via `correspondenceRowFor` /
   `subjectResolution` by **full base identity** (document, base revision, disk revision); the mover's
   anchor via `anchorResolution` **from the same table**. Zero rows and two rows both refuse; a stale
   full identity refuses; array index or arena-node equality is never used as cross-revision
   identity anywhere in the new code. Can the mover's subject resolve on one table and its anchor on
   another? Under unresolved uncertainty, can reapply obtain adoption indirectly?
5. **D2r and R25 over the disk version.** The same-sequence check (`notTheSameSequence`,
   `anchorNotInSequence`) is over the **disk** revision's rows, not the base's; is there a path where
   a move's subject and anchor resolve into different sequences on disk and the move is still
   offered? Is a move still the only edit in its batch?
6. **The `supersedes` arm.** The record says item 3 of 2d-6-2 (the `superseded` origin a verdict
   names is not compared with the shown conflict's) is left. Is that admitted correctly, or does any
   new code claim the comparison happens?
7. **False sentences.** Every doc comment that says what the code forces must say in the same
   sentence what it does not. Read the new field docs on the three session interfaces, the
   `heldDeliveries` docs, the reader-pattern sentences on the settling transitions (§1.6), and the
   record's §2 and §3 for a guarantee the code does not give. A false claim in a record or a comment
   is this project's worst defect class and is a finding at SHOULD-FIX or above.
8. **The i18n describers.** Four new obstacle arms per surface in `src/lib/i18n/index.ts` reuse
   existing keys. Does each arm map to a sentence that is true for it (a `tExternalEvidenceRefusal`
   for missing/mismatched, `tSupersededEvidence` for superseded, the existing notice sentence for a
   retained wait)? Is any `never` terminus reachable?

Re-derive counts and line numbers from the tree, never from the record.

## What NOT to spend budget on

- Whether the seven remaining sub-steps 2d-6-5 … 2d-6-11 should be cut differently.
- The five paths named above as not part of the phase.
- The fifteen corpus fixtures.
- Spanish prose (no key was added; ruling 40's bilingual review is 2d-6-11's).
- Style: JSDoc presence and closing-bracket comments are the worker's discipline; only flag a
  **false** comment, not a missing one.
- The open items the record's §4 already admits, unless one is a defect the record mislabels as a
  deliberate gap.
- Mounted or window evidence — by scope, none; components are 2d-6-7's.

## Report format

Overwrite `docs/reviews/phase-2d-6-4.md`. End with the verdict lines the reviewer definition
requires (`ship` / `ship-with-fixes` / `do-not-ship`; counts of BLOCKERS and SHOULD-FIX). For every
finding give `file:line`, the concrete input or interleaving that breaks it, and what the fix should
do — never just "consider". Say explicitly when a suspected finding was checked and **did not hold**.
