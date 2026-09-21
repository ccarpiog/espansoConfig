# Review brief — Phase 2d-6-1b

**Repository:** `/Users/ccarpio/Developer/Utils/espansoConfig` (macOS Tauri v2 app; Rust core +
`src-tauri/` + Svelte 5 / TypeScript frontend; Vitest). Review the **uncommitted** working tree.

**Write your report to:** `docs/reviews/phase-2d-6-1b.md` (overwrite it).

**Time budget:** 15 minutes.

---

## The phase and its goal

Phase **2d-6-1b** is the second of three sub-phases the orchestrator cut 2d-6-1 into
(`docs/decisions/2d-6-split-notes.md` §2, subsection *"The orchestrator's cut of 2d-6-1"*). It adds
**the observation-protocol members to `BrowserState`** (`src/lib/browser/workspace.svelte.ts`), on top
of the values 2d-6-1a landed (`observationDelivery.ts`, `conflictSource.ts` guards, the
`browser.externalConflict.*` sentences). **Components: none. No Rust change. No new i18n key.** The
rulings that bind it are the record's §3 entries **2, 4, 5, 11, 14, 15, 16, 17, 18, 42** (read them —
`2d-6-split-notes.md` lines ~195-305 and 439). The phase's own record is
`docs/decisions/2d-6-1b-notes.md`. The worker claims to have delivered:

1. **The narrow arbitration/delivery member** (entries 2, 4, 5): `observeExternalChange` now
   arbitrates once and delivers one sealed `ObservationDelivery` to every registered receiver over the
   file (private `arbitrateAndDeliver` / `deliver` near `workspace.svelte.ts:3462` / `:3499`);
   **settlement in the write lease's `close()` now publishes instead of discarding** (`:3654`,
   `:3666`) — the `arbitrateHere` answer that 2d-5-5b left unread; `registerObservationReceiver`
   (`:1447` / `:4654`) with an instance-bound one-shot unregister, a throwing receiver isolated and
   reported. Watermark and accepted sequence are claimed untouched by publication.
2. **The person-requested retry** `retryRetainedObservation(document)` (`:1486` / `:4685`; entries
   16, 17, 18): one attempt per press, refused during an in-flight write, re-entrancy leaving the
   observation retained and askable again, the record's **original arrival generation** and never a
   fresh `observeExternalChange`; delete-first so a re-entrant press finds no record.
3. **The uncertainty acknowledgement** — `uncertaintyAcknowledgementFor` + `acknowledgeWriteUncertainty`
   (`:1514` / `:4715`, `:1547` / `:4748`; entries 14, 15): a **branded one-shot token** in a private
   `WeakMap`, bound to open generation, document, uncertainty generation and standing source; seven
   ordered refusal reasons; caller-controlled operands read before the final checks; refuses in flight,
   after supersession or at an outlived generation; atomically spends and ends the hold; installs
   nothing, issues no command. New private tables `uncertaintyGenerations`, `acknowledgementBindings`,
   `spentAcknowledgements`, `observationReceivers`.
4. **The per-file automatic-reload guard state** `automaticReloadGuardFor` (`:1573` / `:4797`; entry
   15), feeding 1a's pure `decideAutomaticReload` — per file, never per mounted panel.
5. **Entry 41 corrections**: the "exactly two uncertainty exits" and "retained is released only by
   settlement or `open()`" sentence classes corrected in `workspace.svelte.ts`, `conflictSource.ts`,
   `saveOutcome.ts` and `src/lib/i18n/index.ts` (table in the notes §2).

## Changed files (`git diff --stat`, instrument paths excluded)

- `src/lib/browser/workspace.svelte.ts` (+~800 / −~30) — **the product; ~5 950 lines before, read by
  range**
- `src/lib/browser/workspace.test.ts` (+~1 000) — 245 → 268 cases
- `src/lib/browser/conflictSource.ts` (+88 / −few) — the seventh verdict arm, `ArbitrationOutcome`
- `src/lib/browser/observationDelivery.ts` (+121) — `writtenHereDelivery`, `ArbitratedDelivery`
- `src/lib/browser/observationDelivery.test.ts` (14 → 14 cases, reshaped)
- `src/lib/browser/saveOutcome.ts`, `src/lib/i18n/index.ts` — doc-comment corrections only
- `docs/decisions/2d-6-1b-notes.md` — new, the record
- `PROGRESS.json` — the in-progress marker (workflow record, ignore)

**Four paths are deliberately dirty and are NOT part of this phase**: `src-tauri/src/main.rs`,
`src/main.ts` (two hook lines each), `src-tauri/src/probe.rs`, `src/probe.ts` — the temporary
window-reading instrument. Ignore them entirely.

## Verification the orchestrator ran on this tree (each alone, exit 0, read directly)

- `npm run check` — 447 files, 0 errors, 0 warnings (unchanged from 2d-6-1a: no new file)
- `npm test` — **2543 passed, 64 files** (+23 from 2520, all in `workspace.test.ts` 245 → 268;
  `observationDelivery.test.ts` 14 → 14; the two files alone run 282)
- `npm run build` — 192 modules (unchanged); server-only bundle oracle absent (`rg -l` exit 1),
  client-only present (2)
- Cargo gates not run: `git status` shows no path under `src-tauri/` or `crates/` beyond the
  instrument's `main.rs` hook, so the Rust cell is held at 1323.

## Where to attack — the risks, in order

**A green suite is not proof here**; 2d-5-5b's three blockers were all of the shape a gate cannot
catch. Read the members, not only the tests.

1. **The uncommissioned seventh verdict arm `writtenHere`** (notes §1.5; `conflictSource.ts:554`,
   `observationDelivery.ts:173`). The worker argues a session told `retained` would otherwise never
   learn the wait is over when the settlement consumed the held observation as the write's own bytes.
   Attack: (a) is the arm really needed, or does an existing arm (`notLater`, `coalesced`) or the
   existing `BarrierRelease` path already cover it? (b) Is it correctly **excluded** from
   `ArbitrationOutcome` and answered `false` by `isReplacingVerdict`, and is there any path where a
   `writtenHere` envelope reaches a receiver for an observation that is **not** the one that session
   was told `retained` about (a lift delivered to the wrong session or the wrong observation)?
   (c) Does the arm's doc claim more than the code gives — revision equality proves identical bytes,
   never authorship (the `BarrierRelease` caveat)? (d) `ArbitratedDelivery` as an intersection type:
   does it actually narrow at the `switch`, or does a cast hide a sixth/seventh arm?
2. **Settlement publication readmitting an accepted sequence** (entry 2's "without readmitting"; entry
   17's "watermark and accepted sequence are untouched"). Find the settlement path in the lease's
   `close()` (`:3654`, `:3666`) and `releaseBarrier`: does publishing a settlement verdict, or a retry,
   touch the coordinator cursor, the accepted-sequence set or the watermark anywhere — including
   indirectly through `observationTransitions.ts`? A test asserting the watermark unchanged proves one
   path; find the others.
3. **Check-and-spend in the acknowledgement and the retry.** `CLAUDE.md` §6: a check and a spend
   separated by any property read are not atomic; a consuming operation whose boolean is discarded is
   a defect. In `acknowledgeWriteUncertainty` and `retryRetainedObservation`: are **all**
   caller-controlled operands (the token's fields, the `ConflictSource`, the document) read **once,
   first**, before any check, and is the `StandingOriginGuard` (or its equivalent) asked **once and
   last**? Is the spend (the `WeakMap`/`Set` mutation that ends the hold) the same synchronous step as
   the final check, with no `await` and no getter between them? Can a token be spent twice via two
   distinct token objects minted for the same binding (`uncertaintyAcknowledgementFor` called twice)?
   Does "delete-first" in the retry leave a record deleted on a refused path so the observation is no
   longer askable (violating entry 16's "askable again")?
4. **Retry at the original arrival generation** (entry 17). A projection replacement between arrival
   and retry must **not** renew the evidence. Check that the retry path cannot call
   `observeExternalChange`, cannot mint a new arrival generation, and that a retry arriving after the
   generation moved is refused rather than re-arbitrated against the new projection. Also: the retry
   during an in-flight write — is the refusal keyed on the per-document barrier and not on some
   global?
5. **Ruling 18 — negative spy coverage is the only proof.** Confirm the `invoke` spy is asserted at
   exactly zero in **every** new case that arbitrates, retries or acknowledges, not only in a
   representative one; that `drainsUnscripted` is asserted zero file-wide; that every started
   coordinator is disposed; that no write lease is left open. A case that starts a coordinator and
   does not dispose it, or that scripts a drain and never asserts the cursor, is a finding.
6. **Receiver registration.** `registerObservationReceiver`'s unregister is claimed instance-bound and
   one-shot; a throwing receiver "isolated and reported". Attack: can a receiver registered for file A
   receive a delivery for file B? Does unregistering during a delivery loop (a receiver unregistering
   itself) skip or double-deliver to a sibling? Where is "reported" — is it a real signal or a swallowed
   catch?
7. **The per-file guard state** (entry 15): two receivers over one file share **one** hold, closing one
   does not release it, the hold survives the surface closing. Is any of that keyed by a receiver or
   an instance token rather than by the file?
8. **Claims the code does not give.** In the doc comments and in `2d-6-1b-notes.md` §6 *"Where it is
   thin"*: every sentence claiming a guarantee must be one the code gives, and where TypeScript cannot
   force it the same sentence must say so. Ruling 5 in particular: delivery held during a child's own
   awaited write is a **mounted-test fact** (2d-6-6's), and any comment here claiming the ordering is
   enforced is false. The entry 41 corrections: are any of the corrected sentences now **over**-claiming
   (e.g. naming a third exit that the code only partly gives)?
9. **Deviation (c) in the worker's report**: the acknowledgement operand is `ConflictSource` (either
   origin) — read as "standing source". Can a `SaveConflict` source be used to acknowledge an
   uncertainty that belongs to an external observation's hold, or vice-versa, spending the wrong hold?
10. **Deviation (d)**: an acknowledgement is refused (`projectionReplaced`) once the reviewed origin's
    arrival generation is outlived. Is that consistent with entry 14's "at an outlived generation", or
    does it strand a person who reviewed a snapshot that is still the one on screen?

## What NOT to spend budget on

- Whether the seven sub-steps 2d-6-2 … 2d-6-11 should be cut differently.
- The four instrument paths.
- The fifteen corpus fixtures.
- Spanish prose quality (ruling 40's bilingual review is 2d-6-11's).
- Style: JSDoc presence and closing-bracket comments are the worker's discipline; only flag a
  **false** comment, not a missing one.

## Report format

Overwrite `docs/reviews/phase-2d-6-1b.md`. End with the verdict lines the reviewer definition
requires (`ship` / `ship-with-fixes` / `do-not-ship`; counts of BLOCKERS and SHOULD-FIX). For every
finding give `file:line`, the concrete input or interleaving that breaks it, and what the fix should
do — never just "consider". Say explicitly when a suspected finding was checked and **did not hold**.
