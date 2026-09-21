# Review brief — Phase 2d-6-5

**Repository:** `/Users/ccarpio/Developer/Utils/espansoConfig` (macOS Tauri v2 app; Rust core +
Svelte/TypeScript frontend). Review the **uncommitted working tree** against `HEAD` (`b56a021`).

**Write your report to:** `docs/reviews/phase-2d-6-5.md` (overwrite it).

**Time budget:** 15 minutes.

This is the phase's one adversarial review. Blockers found here are fixed and the phase closes; there
is no second round, so a finding this review does not name ships.

## The phase and its goal

**2d-6-5 — raw and restore external sessions.** The raw editor (`src/lib/browser/rawEditor.ts`) and
the restore surface (`src/lib/browser/restore.ts`) gain the external-observation session protocol
2d-6-2 gave the match editor, 2d-6-3 the creator and the recovery form, and 2d-6-4 the delete,
duplicate and move sessions. **Model only: no component, no Rust, no new module, no new i18n key.**

The record's §2 entry (`docs/decisions/2d-6-split-notes.md:122-128`), binding: *"Delivers raw and
restore conflict handling, the declared unsupported reapply, the raw reseed and `\r` refusal, restore's
candidate-preserving retargeting. Acceptance: model tests for CR handling, consent withdrawal,
candidate retention, all three adoption outcomes. Components: none. Bound by entries 6-9, 11, 12, 22,
23."* The rulings are in the record's §3; read **6, 7, 8, 9, 11, 12, 22, 23** verbatim, and 41 (every
production sentence a step falsifies is corrected in the same diff). The phase record is
`docs/decisions/2d-6-5-notes.md` (§1 what changed with line numbers — §1.2 the doors, §1.3 the two
receivers, §1.4 the replacing verdict's reset and the candidate-keeping withdrawal, §1.5 the raw reseed
and the `\r` refusal, §1.6 the declared unsupported reapply, §1.7 the reader on every door; §2 rulings
taken and what each does not force; §3 acceptance pinned; §4 open items admitted; §5 where it is thin).
The shape being copied is `matchDeletion.ts` as 2d-6-4 left it (`docs/decisions/2d-6-4-notes.md` §1),
with its three patterns: (a) every door and settling transition takes an optional reader of the
installed session, read once after the last caller-controlled read; (b) a settlement replay runs in
rounds; (c) a reapply asks its blocks before `enterReapply` — moot here, since both surfaces keep
reapply at `unavailable` (ruling 22).

## Changed files (`git diff --stat`, instrument paths excluded)

```
src/lib/browser/conflictSource.ts      |    7 +-   (entry 41 doc corrections)
src/lib/browser/observationDelivery.ts |   14 +-   (doc corrections)
src/lib/browser/rawEditor.test.ts      |  706 ++++
src/lib/browser/rawEditor.ts           |  852 ++++
src/lib/browser/reapply.ts             |   38 +-   (doc corrections)
src/lib/browser/restore.test.ts        |  878 ++++
src/lib/browser/restore.ts             | 1153 ++++
src/lib/browser/saveOutcome.ts         |   36 +-   (doc corrections)
src/lib/browser/workspace.test.ts      |  387 ++++ (window-fed cases through the real door)
src/lib/i18n/restoreCodes.test.ts      |   10 +-   (the refusal-code list widened 12→14)
docs/decisions/2d-6-5-notes.md         (new)
```

**Four paths are deliberately dirty and are NOT part of this phase**: `src-tauri/src/main.rs`,
`src/main.ts` (modified), `src-tauri/src/probe.rs`, `src/probe.ts` (untracked) — the temporary
window-reading instrument. `PROGRESS.json` is the orchestrator's in-flight marker. Ignore all five.

## Verification the orchestrator ran on this tree (each alone, exit 0, read directly)

- `npm run check` — 447 files, 0 errors, 0 warnings.
- `npm test` — 2807 passed, 64 files (from 2754: `rawEditor` 46→63, `restore` 221→250, `workspace`
  310→317, `restoreCodes` 18→18; the four files together 648, confirmed by a separate run).
- `npm run build` — 192 modules; server-only markers absent, client-only markers present (2).
- No Rust file changed; the Rust cell is held at 1323. No file under `src/lib/components/`, no change to
  `en.json`/`es.json`.

## Where to attack — the risks, in order

**A green suite is not proof here.** Every blocker the last four reviews found (2d-6-1b, 1c, 2, 3, 4)
was an interleaving, a stale capture or a check separated from its spend. Attack these, in order:

1. **The raw `\r` refusal (§1.5; `CLAUDE.md` §6 *Text on the wire*).** `loadDiskVersion` goes through
   `roundTripText(conflict.diskText)` for either origin. Is there any other path — the receiver's
   `raised` arm, a `supersedes`, the replay, `applySave`, `saveCouldNotBeSent`, the `alreadyThere`
   branch — by which a disk text holding a `\r` reaches the draft, or by which a `\r`-bearing draft
   reaches `beginSave`? Is the refusal a terminal step the panel can draw, or does the session silently
   stay put with a confirmed reload that never spends?
2. **Consent withdrawal.** Raw: a `DocumentDoesNotParse` acknowledgement (content-addressed to one
   draft) — can it survive a reseed or a replacing verdict and be spent on different text? Restore: the
   question suspended across the receiver's reads, withdrawn through `withdrawn(…, 'kept')` on a
   replacing verdict — is there an interleaving where a confirmation issued before the verdict is spent
   by `sendRestore` or the final permit after it? Is `coalesced` correctly *not* a withdrawal?
3. **The doors (ruling 8).** Raw `canSave` / `beginSave`; restore `prepareRestore`, `confirmRestore`,
   `sendRestore` and `permitHolds`. Is the external block (external conflict, a retained delivery under
   the session's file key, unresolved uncertainty) asked **after the last caller-controlled read**
   (the draft value, a candidate property, a `projected` read)? Can a getter on a caller-supplied
   object run between the check and the spend? Does any door still answer through a path that never
   consults the four fields? The record's §5 item 2 admits `permitHolds` over-refuses any held envelope
   (`coalesced` / `notLater` included) — is that the safe direction, and is it stated as such?
4. **Candidate retention (ruling 23 "retarget").** A replacing verdict keeps the chosen candidate and
   re-resolves the target against the disk version. Can a candidate for one file be retargeted at
   another? Can the retarget install a target the disk version no longer holds? Restore with **no
   candidate** builds its external model over a placeholder `Draft<string>` of `''` (§2 item 4, §5
   item 1) — is any path able to *save* or *copy* that placeholder, or draw it as the user's text?
5. **The replay queue.** `heldDeliveries` replayed in rounds after `applySave` / `saveCouldNotBeSent`
   (raw) and the three restore settling transitions. Is a delivery that arrives during the surface's
   own command applied to the session the caller **holds after** the answer, or to one captured
   before? Arrival order preserved end to end? Can a replay drop an entry, apply one twice, or replay a
   `retained` against a file key the session has since left? A spent (`restored`) restore session
   takes deliveries (§2 item 7) — can that resurrect a control on a finished surface?
6. **The three adoption outcomes.** `installed | alreadyThere | refused` per surface; `refused` of an
   outlived origin does not reset the warning (ruling 12); refusing under a held reading (2d-6-2 item
   12). Does `alreadyThere` reseed on raw and retarget on restore? Does any path spend the
   confirmation on a `refused`?
7. **Ruling 9 and ruling 12.** Raw `keepEditing` / the restore dismissals: does any dismiss or cancel
   transition null the external block or the retained wait? A replacing verdict resets `reload`,
   retires a standing save conflict, clears a pending restore confirmation; `coalesced` preserves
   source identity and confirmation state; `notLater` changes nothing; `writtenHere` lifts **only** by
   the observation's identity.
8. **The declared unsupported reapply (ruling 22).** `reapplySupport` stays `unavailable` for both;
   `enterReapply` at signature length 1 for raw; restore's `reapplyToDiskVersion` answers
   `unavailable`. Is there any path that offers a reapply, or that obtains adoption indirectly under
   unresolved uncertainty?
9. **False sentences.** Every doc comment that says what the code forces must say in the same
   sentence what it does not. Read the new field docs on both session interfaces, the reader-pattern
   sentences (§1.7 — the docs name 2d-6-6 and 2d-6-8 as owing `() => session`), the placeholder
   draft's field doc, the entry 41 corrections in the four doc-only files, and the record's §2 and §3
   for a guarantee the code does not give. A false claim in a record or a comment is this project's
   worst defect class and is a finding at SHOULD-FIX or above.
10. **The widened refusal list.** `RestoreRefusal` gains `externalConflict` and `observationRetained`
    with shared sentences and no new key — does each map to a sentence that is true for it, and does
    any `never` terminus become reachable?

Re-derive counts and line numbers from the tree, never from the record.

## What NOT to spend budget on

- Whether the six remaining sub-steps 2d-6-6 … 2d-6-11 should be cut differently.
- The five paths named above as not part of the phase.
- The fifteen corpus fixtures.
- Spanish prose (no key was added; ruling 40's bilingual review is 2d-6-11's).
- Style: JSDoc presence and closing-bracket comments are the worker's discipline; only flag a
  **false** comment, not a missing one.
- The open items the record's §4 already admits, unless one is a defect the record mislabels as a
  deliberate gap.
- Mounted or window evidence — by scope, none; components are 2d-6-8's.

## Report format

Overwrite `docs/reviews/phase-2d-6-5.md`. End with the verdict lines the reviewer definition
requires (`ship` / `ship-with-fixes` / `do-not-ship`; counts of BLOCKERS and SHOULD-FIX). For every
finding give `file:line`, the concrete input or interleaving that breaks it, and what the fix should
do — never just "consider". Say explicitly when a suspected finding was checked and **did not hold**.
