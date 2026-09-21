# PROGRESS — espansoConfig

**This file is the authoritative project state, and it is the live head only.** The conversation is not
project state: a fresh session must be able to resume from this file alone. Its size budget is the
autoclaude workflow's (400 lines / 64 KiB soft, 800 / 128 KiB hard); a closing phase moves its
narrative to `docs/progress-archive/` and leaves one table row and a pointer.

- Plan of record: [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md) (§12 holds the phase plan).
- Phase summary: [`PROGRESS.json`](PROGRESS.json), rewritten from this file after every phase and
  never read for a decision; where the two disagree this file is right.
- Rules that bind every session: [`CLAUDE.md`](CLAUDE.md). **Since 2026-09-20 it holds project facts
  only, and the review policy is the workflow's** (`~/.claude/scripts/autoclaude-base.md`): one
  adversarial review per phase, blockers fixed, verification re-run, phase closed. **A fix is not owed
  a review round, and no phase is ever created to re-review a fix.**
- Everything a closed phase left behind:
  [`docs/progress-archive/README.md`](docs/progress-archive/README.md).

**`next-action-history.md` is history, never an instruction.** The only live next action is the one in
this file.

---

## Status

Each row's full narrative — what the sub-phase built, how many review rounds it took and what each one
found — is in [`docs/progress-archive/status-table.md`](docs/progress-archive/status-table.md). The
phase-by-phase completion narrative is
[`docs/progress-archive/completed.md`](docs/progress-archive/completed.md), and the verification
sections and review dispositions are in `phase-0.md`, `phase-1.md`, `phase-2a.md`, `phase-2b.md`,
`phase-2c.md` and `phase-2d.md` in the same directory.

| Phase | Scope | State |
|---|---|---|
| **Phase 0** | The preservation substrate — parser evaluation, span layer, gap scanner, scalar codec, path resolver, patch engine, four operations | ✅ complete; the ⛔️ architectural gate (R4) is **PASSED** with four named qualifications (`docs/decisions/0c-3b-2b-notes.md` §8) |
| **Phase 1** | The read-only browser — core read model, Tauri shell, i18n, IPC surface, three-pane UI, raw text | ✅ complete; plan §12's exit checked in a running window over the real config — 13 files, 65 snippets, zero findings |
| **Phase 2a** | The whole save transaction in Rust with no caller (plan §6.6, all thirteen steps) | ✅ complete |
| **Phase 2b** | The Tauri command surface — twelve commands, six of which write, all five save paths ending in one `run_one_save` | ✅ complete |
| **Phase 2c** | The editing UI — all ten sub-phases of `docs/decisions/2c-split-notes.md`: drafts, the small editor, create/delete/move/duplicate, conflict capture, reapply, recovery, restore from backup | ✅ complete |
| **2d design consult** | Phase 2d put to a design consult before any line of it was written | ✅ complete — `docs/reviews/phase-2d-design.md`; it changed the phase in four places and cut it into eight steps |
| **2d-1** | The core observation engine with no caller — debounce, stability, read, hash, project, validate, over an injected clock | ✅ complete, after five review rounds |
| **2d-2** | The watcher lifecycle behind the workspace session, and the real-filesystem adapter | ✅ complete — READY at round 5 |
| _**2d-3**, **2d-4a** with its five corrective phases, **2d-4a-C-1**, **2d-4a-C-2**, the **2d-4b design consult**, **2d-4b** with its seven, **2d-5-1** with its three, and **2d-5-2** with its three — **nine rows, every chain closed**_ | see the archive | ✅ **all complete and CLOSED**; rows archived 2026-09-05 at 2d-5-3-G to [`status-table.md`](docs/progress-archive/status-table.md) under *"The nine closed-chain status rows"*. 2d-4a (13 rounds), 2d-4b (8) and 2d-5-1 (4) are the three tails this project has ended **by rule** rather than by an owner ruling (`CLAUDE.md` §7.2); 2d-3 (14 rounds) and 2d-4a-C-2 (9) are the two a human stopped |
| **2d-5 design consult** | 2d-5 put to a design consult before any line of it was written, per the standing rule since 2b-2c | ✅ complete (2026-08-31) — [`docs/reviews/phase-2d-5-design.md`](docs/reviews/phase-2d-5-design.md), **Codex at high effort**, the **second provider** to see this material since 2d-4a began. Verdict: cut 2d-5 into **seven** dependency-ordered steps; it overrides `phase-2d-design.md` in two places. The record is [`docs/decisions/2d-5-split-notes.md`](docs/decisions/2d-5-split-notes.md) — 35 binding rulings and a 67-row citation audit — and its own review was `ship-with-fixes`, 0 blockers, 5 SHOULD-FIX, all five fixed in the record |
| **2d-5** | The browser coordinator and the open-write-surface registry — seven steps, of which two touch components | ✅ **complete and CLOSED — all seven steps, 2026-09-21.** Steps 1-6 each closed in their own chains (the 2d-5-3 and 2d-5-4 tails ran fourteen and seven rounds under the §7.1 rule removed on 2026-09-20; step 5 was split into 5a/5b and step 7 into 7a/7b, both halves of each closed). The step-7 window reading is [`docs/decisions/2d-5-7b-window-reading.md`](docs/decisions/2d-5-7b-window-reading.md). What 2d-6 inherits from the pair 2d-5-5a/5b and from 7b is listed under *Next action* |
| _**2d-5-4** and its seven rounds **2d-5-4-A … 2d-5-4-G** — the observation state transitions and the tail the removed `CLAUDE.md` §7.1 rule commissioned_ | `observationTransitions.ts` at `81e54db`, fixed through `ff183e1`; 2d-5-4-H withdrawn 2026-09-20 with the rule. **Components: one comment** | ✅ **2d-5-4 complete and the chain CLOSED at 2d-5-4-G**; A … F each `SUPERSEDED` by the next. **Rows archived 2026-09-21 at 2d-5-7b** to [`status-table.md`](docs/progress-archive/status-table.md) under *"The status rows of the closed 2d-5-4 chain"*; notes `docs/decisions/2d-5-4{,-A…-G}-notes.md`, reviews `docs/reviews/phase-2d-5-4{,-A…-G}.md` |
| **2d-5-5a** | The first half of step 5 — the `ConflictSource` origin union, the memoized save source, the six conflict registrations re-keyed, and origin-switched reapply evidence. Binding rulings **21, 22, 23 and 24**. **Components: none** | ✅ **complete and CLOSED.** Risk class **high**; worker model **opus** (one implementation worker, one fix worker; review by **Codex**, `autoclaude-review.sh` exiting 0 so no fallback agent was spawned — **ten consecutive Codex rounds**). **Verdict `ship-with-fixes`, 1 blocker and 3 SHOULD-FIX**; all four re-derived before any was fixed and **all four held**. The blocker: `rememberTheConflict` wrote `conflictOrigins` unconditionally, so registering one memoized origin twice renewed its projection generation and let an outlived conflict install **backwards** past the fact `adoptDiskVersion` refuses such an install by — fixed by first-registration-wins, with `adoptDiskVersion` untouched. The three SHOULD-FIX: a check-and-spend window in `reapplyEvidenceFor` (the operands are now captured once before the comparisons and the accepted arm returns a frozen snapshot, never the caller's table); and **two false claims**, one in the record and one in a source comment, both corrected to say what is true rather than given machinery to make them true — `ExternalConflictModel` makes `expected` **inaccessible**, not absent, and `rememberExternalConflict` **trusts its caller**. Every gate green at the new rung `1320 / 443 / 2433 / 189`, the frontend three measured twice. Notes [`docs/decisions/2d-5-5a-notes.md`](docs/decisions/2d-5-5a-notes.md); review [`docs/reviews/phase-2d-5-5a.md`](docs/reviews/phase-2d-5-5a.md) |
| **2d-5-5b** | The second half of step 5 — same-revision coalescing, different-revision supersession and the per-document in-flight-write barrier. Binding rulings **25, 26 and 27**. **Components: none** | ✅ **complete and CLOSED, and it closes step 5.** Risk class **high**; worker model **opus** (one implementation worker, one fix worker; review by **Codex**, `autoclaude-review.sh` exiting 0 so no fallback agent was spawned — **eleven consecutive Codex rounds**). **Verdict `ship-with-fixes`, 3 blockers and 1 SHOULD-FIX, all four in source**; all four re-derived before any was fixed and **all four held**. The three blockers were the three shapes the brief asked the reviewer to attack, and no gate could have caught any of them: a retained observation registered at the generation it was **released** at rather than the one it **arrived** at, so a save's own re-read let it install backwards; a re-entrant arbitration that captured the standing origin before reading caller-controlled properties and then spent the verdict without re-checking; and six write leases with **no unconditional cleanup**, so a command rejection stranded the barrier and killed that file's reconciliation silently. The SHOULD-FIX was the same check-and-spend class in `reapplyEvidenceFor`, whose operand is now a `StandingOriginGuard` asked once and last, after every caller-controlled read including row iteration. **Five new cases pin the four fixes, each confirmed to fail against the pre-fix shape**, messages verbatim in `2d-5-5b-notes.md` §8. Every gate green at the new rung `1320 / 443 / 2466 / 189`, the frontend three measured twice. Notes [`docs/decisions/2d-5-5b-notes.md`](docs/decisions/2d-5-5b-notes.md); review [`docs/reviews/phase-2d-5-5b.md`](docs/reviews/phase-2d-5-5b.md) |
| **2d-5-6** | Step 6 — the file-wide route-guard closure: the hoisted `@tauri-apps/api/core` spy and file-wide route assertion in `workspace.test.ts`, `DetailPane.test.ts` and `RestorePane.test.ts`; the zero-drain blanket replaced by exact scripted budgets with cursors; every started coordinator disposed and no write lease left open. Binding rulings **34 and 35**. **Components: none** — three test files and one record | ✅ **complete and CLOSED, and it discharges the one work item 2d-5 inherited** (`2d-4b-notes.md` §14.8 item 1). Risk class **high**; worker model **opus** (one implementation worker; the fix by the orchestrator; review by **Codex**, `autoclaude-review.sh` exiting 0 so no fallback agent was spawned — **twelve consecutive Codex rounds**). **Verdict `ship-with-fixes`, 0 blockers, 1 SHOULD-FIX**, re-derived and **held**: the drain stub answered a drain past the end of its scripted queue with a silent refusal, so ruling 35's queue was finite in one direction only; fixed with an `drainsUnscripted` counter asserted zero file-wide and a negative control confirmed to fail without its reset (`2d-5-6-notes.md` §8). The guard was proven to bite before the review — routing `saveMatch` through the module-level binding failed 16 cases naming `"save_match"`. Every gate green at the new rung `1320 / 443 / 2467 / 189`; no production file changed. Record: [`docs/decisions/2d-5-6-notes.md`](docs/decisions/2d-5-6-notes.md); review: [`docs/reviews/phase-2d-5-6.md`](docs/reviews/phase-2d-5-6.md) |
| **2d-5-7a** | The first half of step 7 — production activation (`AppShell` passes the real event source and starts/disposes the coordinator), the two-entry capability, the `dispatch_check.rs` extension (ruling 33), the mounted lifecycle evidence and all four baselines re-measured. Binding rulings **16 and 33**. **Components: `AppShell.svelte` only** | ✅ **complete and CLOSED.** Risk `high`, worker Opus. Review **Codex, `ship-with-fixes`, 0 blockers, 2 SHOULD-FIX** both in `AppShell.test.ts`, both re-derived — one held in its leak half, one exactly as stated — and both fixed in this commit ([`docs/reviews/phase-2d-5-7a.md`](docs/reviews/phase-2d-5-7a.md), [`docs/decisions/2d-5-7a-notes.md`](docs/decisions/2d-5-7a-notes.md) §9). New rung `1323 / 444 / 2474 / 191` (190 on a committed tree; the design's "+1" missed Tauri's own `event.js`) |
| **2d-5-7b** | The second half of step 7 — the harness rebuilt at `/private/tmp/espansoconfig-harness-2d-5-7b/`, the instrument extended with an IPC recorder over `window.fetch`, and the narrow window lifecycle reading over twelve retained launches. **Components: none** — one record, plus the never-committed instrument | ✅ **complete and CLOSED, and it closes step 7 and with it 2d-5.** Risk `high`, worker Opus. Review **Codex, `ship-with-fixes`, 0 blockers, 1 SHOULD-FIX** in the record (a *"within 270 ms"* bound false for `L04`), re-derived, held, fixed in the record only ([`docs/reviews/phase-2d-5-7b.md`](docs/reviews/phase-2d-5-7b.md); record §11). **Established in a real window**: `plugin:event|listen` resolved under the two-entry capability on every plan launch; the open drained exactly once (`afterSequence: 0`, empty batch); an external replacement produced a new drain answering one `Changed` observation (`seq=1`, disk digest = the fixture's) on three launches, one over a CRLF block-scalar fixture (R38); the no-plan control logged nothing and changed nothing. **Not established**: `dispose()` on window close — no close path unmounts the Svelte tree, and a real Apple Event quit showed no `plugin:event|unlisten`; wake delivery is inferred from timing. Rung unmoved at `1323 / 444 / 2474 / 191` |
| _**2d-5-3** and its fourteen rounds **2d-5-3-A … 2d-5-3-N** — the drain lifecycle coordinator (`reconciliationCoordinator.ts`) and the tail the removed §7.1 rule commissioned_ | 2d-5-3's review was `do-not-ship` (2 concurrency blockers, both re-derived and fixed); thirteen rounds followed, all comment-only after A. **Components: none** | ✅ **the tail CLOSED at 2d-5-3-N** (Codex, `ship-with-fixes`, 0 blockers, fix in the record only); every earlier round `SUPERSEDED`. **Rows archived 2026-09-21 at 2d-5-7b** to [`status-table.md`](docs/progress-archive/status-table.md) under *"The status rows of the closed 2d-5-3 chain"*; notes `docs/decisions/2d-5-3{,-A…-N}-notes.md`, reviews `docs/reviews/phase-2d-5-3{,-A…-N}.md` |
| **2d-6 design consult** | 2d-6 put to a design consult before any line of it was written, per the standing rule since 2b-2c | ✅ complete (2026-09-21) — [`docs/reviews/phase-2d-6-design.md`](docs/reviews/phase-2d-6-design.md), **Codex at high effort**, job `task-mub3r0qh-b6gfi9`, ~19 min. Verdict: cut 2d-6 into **eleven** dependency-ordered steps; it corrects `phase-2d-design.md` item 6 and `2d-5-split-notes.md` in nine places (recovery is an eighth live write surface; removing the last document must not unmount retained sessions; native watcher degradation is not on the wire and stays out; the foreground source comes in as 2d-6-10). The record is [`docs/decisions/2d-6-split-notes.md`](docs/decisions/2d-6-split-notes.md) — 43 binding rulings and a 114-row citation audit (105 resolve, 9 with a note, 0 fail) — and its own review was **Codex through the review script**, `ship-with-fixes`, 0 blockers by count, one finding the reviewer itself labelled a blocker, re-derived, held and fixed in the record's §6 ([`phase-2d-6-design-record-review.md`](docs/reviews/phase-2d-6-design-record-review.md)). Risk **high**, workers **opus** (brief and record), no source touched |
| **2d-6-1a** | The first of three sub-phases of 2d-6-1 (the orchestrator's cut, `2d-6-split-notes.md` §2) — the delivery envelope value, the shared revision description and parent-narrowing type guards, the pure per-file automatic-reload guard, `describeExternalConflict` no longer emitting `changedElsewhere`, and the four `browser.externalConflict.*` EN/ES sentences with their accessors. Binding rulings **4, 10, 11, 13, 14, 15, 24, 32, 39, 40, 41**. **Components: none; no `BrowserState` member; no Rust** | ✅ **complete and CLOSED.** Risk class **high**; worker model **opus** (one implementation worker, resumed once for the fixes; review by **Codex**, `autoclaude-review.sh` exiting 0 so no fallback agent ran). Review **`ship-with-fixes`, 0 blockers, 3 SHOULD-FIX** ([`docs/reviews/phase-2d-6-1a.md`](docs/reviews/phase-2d-6-1a.md)), bodies truncated as always, so all three were re-derived — all three held and all three were fixed in this commit: the Spanish absence scan gained affirmative *saved*/*written* forms with positive controls per locale; `ExternalConflictModel.messages` was **narrowed to a tuple** whose first element the type forces and whose tail it does not, the comment now saying so; the svelte-check decomposition corrected to 444 → 447. **The phase closes here** — one review, blockers none, fixes verified, no re-review. New rung **`1323 / 447 / 2520 / 192`**, the Rust cell held from 2d-5-7b because no Rust file changed. Record: [`docs/decisions/2d-6-1a-notes.md`](docs/decisions/2d-6-1a-notes.md) |
| **2d-6-1b** | The second of three sub-phases of 2d-6-1 — the observation-protocol members on `BrowserState`: `observeExternalChange` returning and delivering a sealed envelope to registered receivers, settlement publishing through the same path, `registerObservationReceiver`, `retryRetainedObservation`, `uncertaintyAcknowledgementFor` + `acknowledgeWriteUncertainty`, `automaticReloadGuardFor`; the entry 41 corrections in four `src/` modules; plus the uncommissioned seventh verdict arm `writtenHere` (notes §1.5). Binding rulings **2, 4, 5, 11, 14, 15, 16, 17, 18, 41, 42**. **Components: none; no Rust; no new module; no new i18n key** | ✅ **complete and CLOSED.** Risk class **high**; worker model **opus** (one implementation worker, resumed once for the fixes; review by **Codex**, `autoclaude-review.sh` exiting 0 so no fallback agent ran). Review **`ship-with-fixes`, 1 BLOCKER, 2 SHOULD-FIX** ([`docs/reviews/phase-2d-6-1b.md`](docs/reviews/phase-2d-6-1b.md)), all three in `workspace.svelte.ts`, bodies truncated as always, so all three were re-derived by writing the failing case first — **all three held and all three were fixed in this commit**, six new cases pinning them: the blocker — a receiver's fault could still escape the settlement path (a throwing reporter, or a thrown value whose `code` getter throws inside `classifyFailure`) out of the lease's `close()` through the wrapper's `finally`, **turning a committed save into a rejection** — fixed by a second non-throwing boundary around the reporting, the one place this state drops an error, said where it happens; a re-entrant publication reaching sibling receivers out of order — fixed by making `deliver` a synchronous drain queue that hands out each (observation, verdict kind) pair once; a throwing retry arbitration losing the retained record — fixed by restoring it into an empty slot only (`has` then `set`, nothing between). The reviewer checked and did **not** uphold acknowledgement double-spending, cross-file hold spending, sequence readmission, arrival-generation renewal or unregister interference. **The phase closes here** — one review, blockers fixed, verification re-run, no re-review. New rung **`1323 / 447 / 2549 / 192`**, the Rust cell held. Record: [`docs/decisions/2d-6-1b-notes.md`](docs/decisions/2d-6-1b-notes.md) |
| **2d-6-1c** | The third and last of the three sub-phases of 2d-6-1 — the coordinator and workspace members on `BrowserState`: `ReconciliationHost.reconciliationChanged()` feeding one revision signal, `reconciliationRevision()` over a single `$state` counter; `reconciliationWatchState()` and the sanitized `reconciliationRegistration()` (`failed: { reason: 'noTransport' \| 'rejected' }` — the §6 item 11 exposure, claimed); the two argument-less guarded reload requests `requestMembershipReload()` / `requestLostHistoryRecovery()` through the coordinator's new `reopenFromRetainedRequest()`; `requestFileReread(document)` through `rereadUnderGuard` with the same guard at request and at installation; the entry 41 corrections in the files it touches. Binding rulings **28, 29, 32** and §6 item 11. **Components: none; no Rust; no new module; no new i18n key** | ✅ **complete and CLOSED, and 2d-6-1 closes with it — its full acceptance is checked in [`2d-6-1c-notes.md`](docs/decisions/2d-6-1c-notes.md) §3.** Risk class **high**; worker model **opus** (one implementation worker, resumed once for the fix round; review by **Codex**, `autoclaude-review.sh` exiting 0 so no fallback agent ran). Review **`ship-with-fixes`, 1 BLOCKER, 1 SHOULD-FIX** ([`docs/reviews/phase-2d-6-1c.md`](docs/reviews/phase-2d-6-1c.md)), bodies truncated as always, so both were re-derived by writing the failing case first — **both held and both were fixed in this commit**, plus one sibling site found by sweep, four new cases pinning them: the blocker — the installation guard of `requestFileReread` ran caller code, because `ownedProjectionOf` copied `top_level_keys` by reference and a key-text getter read inside `creatorEligibilityFor` during the guard could open a surface under the guard's own checks — fixed at ingress with `ownedScalarOf()` copying every top-level key, so the guard runs no caller code *because of* ingress, and the doc comments on `ownedProjectionOf`, `automaticReloadGuardFor` and `fileRereadRefusal` say so; the SHOULD-FIX — a host `reconciliationChanged()` that disposed the coordinator from the `registering` notification left `start()` taking a foreground listener on a disposed coordinator — fixed by rechecking `disposed` after `register()` and again after `foreground.subscribe` (unsubscribing at once); the sibling — the pending-splice notification disposing the coordinator mid-drain — fenced with it. Checked and not held (notes §6): the `workspaceOpened` / `workspaceReady` / `failed` / `abandoned` arms, `rememberReason`, `ensurePumping` / `release`, `reopenFromRetainedRequest`, `record`, the observation loop; the reviewer checked and did **not** uphold whole-reload registry getter exposure, reopening on final-surface release, retained-request substitution or registration-object leakage. **The phase closes here** — one review, blocker fixed, verification re-run, no re-review. New rung **`1323 / 447 / 2574 / 192`**, the Rust cell held. Record: [`docs/decisions/2d-6-1c-notes.md`](docs/decisions/2d-6-1c-notes.md) |
| **2d-6 … 2d-8** | The remaining three steps of the 2d consult's eight; 2d-6 is eleven sub-steps `2d-6-1` … `2d-6-11` per its consult, 2d-6-1 cut into `1a`/`1b`/`1c` | 🔶 **2d-6-1 done** — all three sub-phases closed, the last at 2d-6-1c; **2d-6-2 is next** |
| **2d** | External change reconciliation — plan §6.5 | 🔶 in progress |
| **3–5** | Validation, packaging, hardening | ⬜️ not started |
| **M — checkpoint split** | This file cut from 21,803 lines to the live head; the rest archived verbatim under `docs/progress-archive/` | ✅ complete (2026-08-29) — preflight maintenance, unreviewed by rule |
| **M2 — tail termination** | The review loop given a stopping rule the files can evaluate: `CLAUDE.md` §7 | ✅ complete (2026-08-29) — two review rounds, both `not-ready`, all findings fixed. **The rule it built was removed on 2026-09-20**: it produced a fourteen-round tail on 2d-5-3 and a seven-phase one on 2d-5-4, and the workflow's own review rule replaces it |

---

## Standing rules

These bind every future phase. The reasoning behind each is in
[`docs/progress-archive/decisions.md`](docs/progress-archive/decisions.md) (D1 … D4).
[`CLAUDE.md`](CLAUDE.md) states the project's code rules and is not repeated here. The review
policy is the autoclaude workflow's, and this file adds none.

**The three things the gate does not license.** Each has a reason on file:

- **Presenting a plain scalar's *type*** to the user — R16's open half. Decided (D2u): the UI shows a
  scalar's source text as written, never an inferred type; flagging one as 1.1-ambiguous is permitted,
  because that is a claim about risk, not about meaning.
- **Moving a match between files or between sequences** — D2r; `ItemMove` is same-sequence only.
- **Combining a move with any other edit in one batch** — R25.

**Preservation.**

- The file text on disk is the source of truth and the typed model is a read-only projection over it:
  every edit is a byte-span replacement, and everything outside the intended span comes out
  byte-identical.
- `espansoconfig_core::persist::save_document` is the **only** entry point that may write a user's
  file. Never call `replace_file_atomically` or `replace_locked_file` from a command or from inside the
  transaction — the lock is not reentrant, so the process hangs silently and forever.
- A save is refused, never forced: there is no `force` flag, findings go out and the acknowledged
  subset comes back as an exact multiset, `committed: false` with `backup: None` is legal on a success,
  and a committed write is never afterwards reported as an error, in TypeScript as well as Rust.

**Architecture and evidence.**

- `crates/espansoconfig-core` must never depend on `tauri`; the check is
  `cargo tree -p espansoconfig-core | rg tauri`, which must find nothing (D2x — `rg -c tauri Cargo.lock`
  is no longer evidence for it).
- The real espanso config is never committed (D1), and its content is never quoted in a document, a
  commit message, a comment or a report.
- Every user-facing string goes through i18n, English and Spanish both, and a component renders a code
  by calling an accessor in `src/lib/i18n/codes.ts`, never by building a key.
- A green test suite is not a screen: a claim about what a window draws needs a look at a window.
- A decision record that claims a guarantee the code does not give is this project's worst defect
  class. Where the type system cannot force something, say so in the same sentence that says what it
  does force.

---

## Open risks and deviations

Live risks in full, then the ones that are demonstrably closed, compacted to one line each with the
decision that closed them — those decisions are in
[`docs/progress-archive/decisions.md`](docs/progress-archive/decisions.md).

**Twelve Phase 0 substrate rows are in
[`phase-0.md`](docs/progress-archive/phase-0.md)** under *"The Phase 0 substrate risk rows"* (archived
verbatim at 2d-4b-E) — **none withdrawn or downgraded**, so a session touching that substrate reads
them as part of this table. **R12, R16 and R25 deliberately stayed**, because later phases read them
here: R16's open half is what D2u constrains, and R25 is named in *Standing rules*.

| # | Risk | Mitigation / state |
|---|---|---|
| R12 | **Refusal for anchors, aliases, tags, merge keys, duplicate keys and multi-document streams is broad, and was previously recorded here as *total*.** A file using any of them is largely, but not entirely, non-editable in the visual UI | Accepted, and it is the specified behaviour: plan §7 rows 7–8 say *detect and refuse*, and §13 defers visual editing of anchors, aliases, tags and merge keys out of v1. **"Total" was wrong, and 0c-2b measured it.** The gate refuses the flagged node, its ancestors and its descendants, so a **sibling** stays editable: `anchors-aliases-tags-merge.yml` refuses 12 addressable scalars and **applies 5** — `matches[2].trigger` is editable although the explicit-tag hazard sits on the `replace` beside it — and `duplicate-keys.yml` is 2 refused / 8 applied. Only a hazard on a **document** node reaches everything, which is why `multi-document.yml` really is total. The gate's behaviour is unchanged and safe; only this prose needed narrowing. Pinned by `the_hazard_gate_refuses_by_scope_and_not_by_file`. R12's other claim is confirmed: **2 004 of 2 004** attempted real-corpus edits applied, zero refusals, so the breadth costs this corpus nothing today. If a future corpus does trip it, the escape hatch is a *narrower* hazard scope, not a weaker gate. |
| R16 | **The round-trip oracle parses with saphyr (YAML 1.2), but espanso consumes with a YAML 1.1-ish stack.** Agreement with saphyr does not prove the file means the same thing to espanso | **Partly closed in 0c-3b-2b (D2s), and the open half is stated so it cannot be mistaken for mitigated.** *R16 stays open: byte preservation and conservative emission prevent edits from changing untouched bytes or introducing known YAML 1.1-ambiguous plain scalars, but the UI projection of pre-existing plain scalars is not yet proven to match espanso's resolver.* **Closed half:** an in-house 1.1/1.2-core tag table in the library, consulted by the emitter and asserted in `verify()` as a differential property, so an edit can neither introduce a new ambiguity nor change an existing classification. Building it found D2h's predicate writing **34 distinct 1.1-ambiguous values plain** — a real corruption path, now fixed. **Open half:** the *projection*. 31 synthetic and 65 real plain scalars resolve non-`str` under 1.1 today; the app would display them as strings. **The UI consequence is settled by D2u — the browser shows source text, never an inferred type — so the open half costs display richness, not correctness.** R16 closes only when the projection is proven against espanso's actual resolver, which is also what would unlock type-aware rendering. **Residual risk:** a pre-existing or explicitly tagged scalar may be displayed or used by the typed projection with a different type/value than espanso assigns, and an incomplete hand-maintained resolver table or an espanso-specific schema change could leave that disagreement undetected. **Two named weaknesses:** explicit tags are outside the table entirely, and the **1.2-core half has no second implementation** (the 1.1 half has one, differentially swept over 500 000 values with zero disagreements). Deliberately **no second parser crate** — see D2s for why, and do not add one without re-reading it. |
| R25 | **Move verification is not compositional** — `MoveMustBeTheOnlyEditInItsBatch` refuses a batch pairing a move with any other edit, including the safe and obvious "move this match and change its `replace`" | Accepted as a **deliberate phase-scope limit, not an invariant**, and relabelled as such after the 0c-3b-2a review found the original circularity argument unconvincing. It conceals no demonstrated splice-order bug — a single move still exercises descending application of its own runs. Two costs, both recorded: the safe combined request above is refused, and **`OverlappingEdits` is consequently never tested against a move-versus-edit conflict**, because the restriction rejects such batches before overlap analysis runs. Closing it means applying the permutation to a combined expectation and exempting precisely the independently verified rewritten node, which is how field batching already works. Revisit when the UI needs it or when cross-file move lands. |
| R27 | **A held identity goes stale on every reparse, and the UI is what holds identities.** `MatchId` is refused across a revision change (D2v), which is correct and is not free: a selection, a scroll position or an open editor pane held across an external file change now meets `IdentityError::StaleRevision` | Accepted, and it is the specified behaviour — refusing beats resolving to the wrong match, which is what the code did before the Phase 1a review. **The cost lands squarely on Phase 1b/1c**: every lookup that can cross a `refresh()` must handle the error rather than unwrap it, and the UI needs a re-selection policy (most likely: re-resolve by `DocumentPath`, which is the thing designed to survive a reparse, then fall back to clearing the selection). Plan §6.5's reconciliation already requires that conversation, so this adds a case to it rather than a new mechanism. Pinned in both directions by `an_identity_from_before_a_reordering_is_refused_rather_than_resolved`, which also asserts that reprojecting *identical* bytes mints the *same* identity. |
| R28 | **`Deserialize` on `ByteSpan` bypasses `ByteSpan::new`'s inverted-span assertion.** A frontend-supplied span is currently only ever echoed back, but nothing in the type system says so | Accepted **for a read-only phase, and dangerous the moment a mutation trusts a span that crossed the IPC boundary.** `serde` is `Serialize`-only except for a named list — `DocumentId`, `NodeId`, `DocumentPath`, `PathSegment`, `ByteSpan`, `MatchId` — which are exactly plan §6.4's command *arguments*. `ContentRevision`'s hand-written `Deserialize` accepts only the 64-character hex string its `Serialize` writes, so a malformed concurrency token is a typed rejection rather than a digest that quietly matches nothing. **Phase 2 must not let a deserialized `ByteSpan` reach the patch engine without revalidating it**, and must not widen the `Deserialize` list without re-reading `docs/decisions/1a-notes.md` §9 hole 6. |
| R29 | **An unmodelled subtree is accounted for by span, not by name** (D2w): a key nested under an unrecognised option is proven present but is not addressable, searchable or displayable | Accepted as the deliberate trade, and recorded as a hole rather than folded into the "no key is dropped" claim — which is how the Phase 1a review found it. Measured cost: **28 of 546 synthetic keys** are span-accounted rather than named, and **0 of 566 real ones**, so the live config loses nothing today. Two second-order weaknesses named with it: accounting is by *containment*, so an over-wide recorded span would over-account (unreachable today, since every span comes from a published node), and two `UnknownEntry` reasons carry no path by construction — `NonScalarKey` (no `PathSegment` can spell such a key) and `RepeatedKey` (a path would name the *first* entry, not this one). A later phase that wants to render such a subtree must decide how, not assume the projection already did. |
| R31 | **The hardcoded-string check sees markup only.** It scans `src/**/*.svelte` for literal text outside `t()`, and is blind to `<script>` bodies, `{'literal'}` expressions, `.ts` string constants and props — so a clean run means *"no literal sits in markup"*, not *"no hardcoded string exists"* | Accepted and **stated in those words** rather than as a passing check (`docs/decisions/1b-1-notes.md` §7). Its blind spots are pinned as tests, so the boundary is asserted rather than remembered, and it was proven able to fire against the real tree rather than only to pass. The residual exposure grows with every phase: 1c is almost entirely user-facing strings, and the class of string this check cannot see — an error message assembled in a `.ts` store — is exactly what 1b-2's code dictionaries produce. **Re-read this row before adding any string outside markup.** |
| R32 | **Nothing renders, and "the process stayed up" is not evidence that anything did.** No test mounts `AppShell` or asserts that switching the picker re-renders; `npm run tauri build` has never been run, so the bundler, the `.app` layout, the `Info.plist` merge and the production CSP are untested end to end | Accepted for 1b-1 and **owed by 1c**, which is the first phase with a screen worth asserting about. **This risk stopped being hypothetical inside the phase itself.** 1b-1 first reported the shell "smoke-launched and stayed up"; the fix round found a missing `custom-protocol` feature meant every binary loaded the dead `devUrl`, so that window was **blank** and `npm run tauri build` could not have succeeded. A launched process proved the window and webview were created and **nothing whatever** about what was painted in them — which is precisely what the risk says, demonstrated. It was separated from a frontend exception only by planting a static `<h1>` in `dist/index.html` and watching that fail too. A DOM environment (`jsdom` / `@testing-library/svelte`) is a deliberate future decision rather than a default, and `vite.config.ts` says so at its `environment: 'node'` line; the `$effect` half of the document-language sync is untested for the same reason. The bundler half is Phase 5's subject (plan §10, `SIGN_AND_NOTARIZE.md`). **Standing instruction: never again record a hand launch as evidence about rendering.** |
| R34 | **The macOS application menu is unlocalized**, so a Spanish user meets an English menu bar — a live exception to CLAUDE.md §2, which is non-negotiable | **Open, owed by 1b-2, and it is a recorded disagreement rather than a settled hole.** The Phase 1b-1 reviewer's position is that the phase should not have closed while it stands. The rebuttal on file: Tauri v2 builds the default menu in Rust, so localizing it needs either Spanish strings in Rust — which plan §9 forbids in as many words — or menu labels handed across IPC, which needs a command, and 1b-2 is the phase that has one. `CFBundleLocalizations = [en, es]` and `CFBundleDevelopmentRegion = en` are already declared. Both halves of the argument are in `docs/decisions/1b-1-notes.md` §9 hole 1 so a later session can overrule this one **on the evidence** rather than rediscover the question. |
| R35 | **Nothing establishes that a Spanish string is Spanish.** The dictionary suite checks key parity, placeholder parity and non-identity with the English value — a translation reading `"Sprache"` passes every one | Accepted, and the *claim* was corrected rather than the code: the suite is named for the untranslated-value heuristic it is, per the review's finding 5, and the `"Sprache"` counterexample is written into the notes and the module doc comments so the boundary cannot be forgotten. Closing this needs reviewed expected translations or a bilingual review gate — a process, not a test — and the cost grows with every phase, since 1c is almost entirely user-facing strings. Two smaller relatives named with it: the duplicate-key scanner compares **key text** rather than decoded escapes, and `webview-floor.test.ts` pins the esbuild target against the plist floor for *consistency* only — esbuild constrains syntax, not library APIs, so a newly used API with a higher baseline than the target would still slip through. `Object.hasOwn` was exactly that shape. |
| R33 | **TypeScript is pinned to 6.0.3, one major behind 7.0.2**, because `svelte-check@4.7.4` declares `typescript: ^5 \|\| ^6` | Accepted and dated. The whole i18n guarantee is a *compile-time* one, so the version that compiles it is load-bearing: an upgrade that changes how `Record<Exclude<keyof T, TranslationKey>, never>` behaves would weaken `ExactDictionary` silently. The four disabling experiments of `1b-1-notes.md` §2 are the tripwire — **re-run them after any TypeScript or `svelte-check` upgrade**, because they are the only thing that would notice. |
| R30 | **Nothing in the projection is proven against espanso itself.** The field list is plan §3's, verified against espanso 2.3.0 and its JSON schemas — but by the plan's author, not by any test in this repository | Accepted, and the failure mode is the right one rather than a silent one: a field espanso has and plan §3 lacks lands in `unknown_entries`, where D2w's accounting proves it survived and R29 records that it is not rendered. That is not the same as being correct. Closing this means a differential check against espanso's own schema, which is a Phase 3 concern at the earliest (plan §12 puts unknown-field preservation *verified end to end* there). |
| R36 | **There is no relation that can follow an open draft to the snippet it edits across a reparse**, and 2c-3b-1 deliberately did not invent one. `moveEligibility`'s `unsavedDraft` rule compares **whole identities**, so the moment the draft's identity is older than the projection the eligibility is computed over, the rule **stops matching and the move is allowed** — and a commit strands those edits | Open, recorded as hole 18 of `docs/decisions/2c-3b-1-notes.md` and in `moveEligibility`'s own doc comment. **`identityInProjection` is not the producer that closes it, and the record claimed it was for one round**: it resolves by **arena node alone**, so with draft A at R0/node 10 and an unrelated snippet B at R1/node 10 it answers B's identity and the rule refuses **B** — the defect the round before had just closed, reached through the producer prescribed to close it. It is safe as a **check** (`confirmDelete` and `sessionIsLive` require equality including the revision) and unsafe as a **producer**. Two shapes would settle it, and step 2 must choose one: a coordinator that owns the editor-to-snippet relation and re-points it in the same synchronous block that installs a new projection — the shape `repairAfter` already has for the *selection* — **or** a rule that a snippet with a stale draft is not offered a move at all until the draft is saved or discarded. **Not** a lookup that infers cross-revision identity from an arena node, whatever it is named |
| R38 | **Every window reading this project has taken ran on one easy fixture shape, and none of the fifteen corpus fixtures `CLAUDE.md` §4 lists has ever been through the harness.** 3c-2's 71 launches used plain `replace:` scalars, double-quoted triggers, one leading comment, LF, no BOM — no block scalars, no item-owned comments, no blank-line runs, no second sequence, no read-only file, no package. The fifteen fixtures exist *precisely because those shapes behave differently* | Open, and stated as 3c-2 §12's own bound rather than discovered later. It is **not** a defect claim: the byte-exactness of every edit over both corpora is what the Phase 0 gate discharged, at the core, with a property test. What is unevidenced is the **window's** behaviour over those shapes — a reapply refusal drawn against a block scalar, a conflict panel over a file with item-owned comments. The harness dies at 3d, so closing this means rebuilding it; the cheaper mitigation is to add one hard fixture shape to whichever instrument the next reading-bearing phase builds, rather than to reopen 2c-4b for it. **Narrowed at 2d-5-7b**: the rebuilt harness carried one hard shape — a CRLF block-scalar replacement fixture — through a real launch (`L05`), and the delivery drain answered it exactly as the plain fixture's; that is a reading of *delivery*, not of a screen drawn over the shape, so the window half stays open for 2d-7 |
| R39 | **A shared user-facing string is not a shared predicate, and a sweep that assumes otherwise manufactures findings in both directions.** 2c-4b-3c-2's review found `browser.notice.differentMatch` claiming an identity its producer cannot give — and then found the fix round alleging the same defect in `displacedByMove` and `displacedByDuplicate`, where the revision guard on each attributed adoption path *earns* the claim | Open as a standing method rule, not as a defect. Four notices carried one clause; two are false and two are true, and **only reading each notice's own producer separates them**. The cost of getting it wrong is symmetric: a missed instance ships a false sentence, and a manufactured one hands a later step work that does not exist and invites a "fix" that breaks a correct sentence. **`browser.notice.gone` is the untested half** — it is length-based, source-derived and was **never drawn in any of the 110 launches**, so its half of the finding has no screen behind it |
| R37 | **A model rule that reads the live projection agrees with itself only over consistent inputs, and nothing forces a caller to supply them.** `matchMoveView(session, R0Views)` answering `canMove: true` beside `beginMove(session, identityInProjection(R1Views, …))` answering `null` type-checks, and no signature refuses it. The same shape is `beginMove`'s `projected` argument and `confirmDelete`'s, where nothing in TypeScript can say where an argument came from | Accepted and **stated in the same sentence as what the code does force** — in `refusalGiven`, in `beginMove` and in the two module headers — after a review round found the record claiming the two "cannot disagree by construction". What would close the remaining half is a requirement on the caller: **a component must derive the view, the destination options and the submission identity from one read of the current projections, in one synchronous block.** A screen holding a stale copy of `BrowserState.views` gets the stale answer from every one of them, consistently and wrongly |

**Closed risks** — the full index of every risk this project has closed, with the phase and decision
that closed each, is in
[`docs/progress-archive/decisions.md`](docs/progress-archive/decisions.md) under *"The closed-risk
index"*. **It was archived at 2d-5-2a because it is pure index**: no row is work, and no later phase owes
any of them anything.

---
## Next action

### Phase 2d-6-1c is complete and CLOSED, and **2d-6-1 closes with it** — its full acceptance is checked in one place, [`2d-6-1c-notes.md`](docs/decisions/2d-6-1c-notes.md) §3. The next action is **Phase 2d-6-2 — match-editor external session and reapply**, the first step that consumes what 2d-6-1 landed.

**The three documents that bind every 2d-6 step, in reading order**:
[`docs/reviews/phase-2d-6-design.md`](docs/reviews/phase-2d-6-design.md) (**the consult; it binds** — Codex at
high effort, 2026-09-21, eleven rulings, no gate run and none claimed),
[`docs/decisions/2d-6-split-notes.md`](docs/decisions/2d-6-split-notes.md) (the record — §2 the eleven-step
split with per-step scope, acceptance and the rulings that bind it, **the 2d-6-2 entry at lines 96-103**; §3
forty-three binding rulings; §4 the citation audit; **§5 nine corrections that override `phase-2d-design.md`
item 6 and `2d-5-split-notes.md` — read them before treating either as the spec**; §6 what was not settled; §7
the map of the handed-on obligations and open items 0-11; §8 its review) and
[`docs/decisions/2d-6-design-brief.md`](docs/decisions/2d-6-design-brief.md) (the brief).

**The consult's verdict, in one paragraph**: 2d-6 is not seven callbacks plus translated markup; it needs a
complete observation-to-session protocol — delivery after write settlement, model-owned submission blocking,
origin-correct messages. Two corrections to the inherited design: **recovery is an eighth live write surface**,
and **removing the last document must not unmount retained sessions**. Native backend-status exposure stays
outside the phase; the DOM foreground source (open item 8) comes in as step 2d-6-10; every component-changing
step owes a narrow window regression reading; mounted evidence is bilingual.

**What 2d-6-1 landed, none of it consumed by production yet** (ruling 42; member names only — each record's §1
has signatures, refusal reasons and line numbers, §2 its rulings: `docs/decisions/2d-6-1a-notes.md`,
`2d-6-1b-notes.md`, `2d-6-1c-notes.md`). **1a**, values, no `BrowserState` member: `ObservationDelivery` and
`decideAutomaticReload` in `src/lib/browser/observationDelivery.ts`; `conflictRevisionsOf`, `isSaveConflict`,
`isExternalConflict` in `conflictSource.ts`; `describeExternalConflict` emitting `fileChangedWhileOpen`; the
four `browser.externalConflict.*` keys with accessors. **1b**, on `BrowserState` (`workspace.svelte.ts`):
`observeExternalChange` delivering a sealed envelope to every receiver registered over the file, settlement
published from the write lease's `close()`, `registerObservationReceiver(document, receiver)`,
`retryRetainedObservation(document)`, `uncertaintyAcknowledgementFor` + `acknowledgeWriteUncertainty`,
`automaticReloadGuardFor(document)`, and the seventh `ObservationVerdict` arm **`writtenHere`**. **1c**: on the
coordinator `ReconciliationHost.reconciliationChanged()` and `reopenFromRetainedRequest()`; on `BrowserState`
`reconciliationRevision()`, `reconciliationWatchState()`, the sanitized `reconciliationRegistration()`,
`requestMembershipReload()` and `requestLostHistoryRecovery()`, and `requestFileReread(document)`.

**Executable cold — 2d-6-2**, the record's §2 entry quoted in full: *"**Delivers** the editor's
`externalConflict` field, the restriction at `canSave` and `beginSave`, the confirmation reset on a replacing
verdict, and the full-identity `editor` correspondence lookup; save history and field intent survive.
**Acceptance:** model tests over pristine and edited drafts, collisions, all four evidence arms and all three
adoption outcomes; `beginSave` called directly under an external conflict answers `null`. **Components: none.**
**Bound by** entries 6-9, 11, 12, 19, 20, 22. **Depends on** 2d-6-1."* The nine rulings it binds (§3 has each
one's full text and what it does *not* force): **6** `externalConflict: ExternalConflictModel<T> | null` on each
immutable session, `SaveOutcomeModel` save-only; **7** only one conflict is active, a committed success stays as
history; **8** "cannot submit" is a model rule at `canSave` and `beginSave`, tested past a disabled button, and
it cannot force its inputs to be current (R37); **9** the unconditional dismissal never erases an external
block; **11** every verdict has a named session action — **plus the seventh arm 1b added, `writtenHere`: lift
the restriction recorded for that observation and change nothing else** (1b notes §1.5 and §5 item 2; switch
with a `never` terminus so no arm is skipped silently); **12** a replacing verdict resets `reload`, clears
confirmations and invalidates displayed reapply results in the model transition; **19** the external
correspondence lookup, never a `supported` reapply that always falls back; **20** correspondence converts by
full base identity, never by array index or arena node; **22** refusals resolve to manual resolution with the
typed sentence, and under unresolved uncertainty reapply may not obtain adoption internally. **Decisions are
values in `src/lib/browser/matchEditor.ts`; no component is touched** — none registers a receiver before 2d-6-6,
so the tests feed the session its envelopes through 1b's `observeExternalChange` / `registerObservationReceiver`
and read 1c's `reconciliationRevision()` and requests as a model. **The command spy stays at zero** through
every session transition (rulings 34/35 of the 2d-5 record); a reload request that reaches `open()` is the one
place a command is expected, scripted. **Inherited as well**: the four umbrella `browser.reapply.*` sentences
(`manualResolution`, `adoptionRefused`, `unavailable`, `notAttempted`) still ending *"Nothing was written"*,
overbroad after an uncertain write, taken with the register review this step owes, and `index.ts`'s *"says only
that nothing was applied, written or moved"* with them (1a notes §5 item 1).

**Orchestrator's rulings taken at 1b's close**: (1) **the `ReconciliationWorkspace` interface is not widened**
in 2d-6-1 — ruling 4's "narrow arbitration/delivery member" is the `BrowserState` member,
`observationTransitions.ts`'s `tellTheSurfaceAbout` still hands the registered `WriteSurfaceTransition` the bare
observation, and routing it through `observeExternalChange` with child-reported receivers is **2d-6-6's**, one
interface member and one host line (1c kept to this). (2) **The acknowledgement operand stays
`ConflictSource`**, so a file under the hold with a save refusal standing has an exit; 2d-6-9 draws it. (3)
**The `projectionReplaced` refusal at an outlived arrival generation stands** as the consult's item 3 read
literally; whether a snapshot still on screen counts as current is **2d-6-9's** to decide (1b notes §5).

**Open items 2d-6-1 deliberately left, none a defect of it** (1a notes §5, 1b notes §5, 1c notes §5). **From
1c**: a disposal from `host.openGeneration()` still costs one refused drain (pre-existing); an uncertainty that
settles while a person's reread is out is unseen by the guard — the raw wrapper's own re-read supersedes first,
and `completed` truthfully says the read neither failed nor was refused; `completed` does not claim "installed"
(`rereadUnderGuard` answers `null` for a discard and an install alike); the notification over-approximates by
design (a count is what ruling 28 asked for); the registration rejection reaches no developer channel
(pre-existing). **From 1b**: `classifyFailure`'s "never throws" sentence in `src/lib/ipc/errors.ts` is false for
a thrown value with a hostile `code` getter (pre-existing; corrected when a step next changes that module); a
hostile `sequence` getter can defeat its own retention inside the retry's restore comparison, and a receiver
that manufactures a fresh observation on every delivery loops through this door as through the coordinator (both
stated in the code — the drain bounds repetition, not invention). **From 1a**: the Spanish of the nine bounded
sentences awaits ruling 40's bilingual review (**2d-6-11's**); the stale "nine codes" sentence in
`saveOutcome.ts` / `index.ts` (corrected when a step next changes those modules' list).

#### ⚠️ READ FIRST — the working tree is deliberately NOT clean, and that is not a killed phase

`git status --short --untracked-files=all` shows **four uncommitted instrument paths** — `M
src-tauri/src/main.rs` and `M src/main.ts` (two hook lines each; `git diff --stat` over the pair is `5
insertions(+), 1 deletion(-)` and must stay that way), `?? src-tauri/src/probe.rs` and `?? src/probe.ts`.
**Do not commit them, do not revert them, and do not treat them as unaccounted-for work.** They are the
temporary window-reading instrument (`CLAUDE.md` §6, *Window readings*); 2d-8 deletes it. **Stage by
path**: `PROGRESS.md`, `PROGRESS.json`, `docs/`, `src/lib/browser/`, `src/lib/i18n/`, `src/lib/ipc/`, and
any `src-tauri/` or `src/lib/components/` file **by name** — never `src-tauri/src/` as a directory. The
2d-6 steps that add a component or a `.ts` module move the Vite module count (one per module, two per
styled component) and the `ipc-detail` row count (one per file under the scanned roots) — re-derive per
file, never from the total, and remember the instrument's known contribution (`Verification baseline`).
**A worker must never run `git stash`**: 1a's worker did so by accident inside a compound command and
reversed it at once (`2d-6-1a-notes.md` §6); the instrument survived, but a stash that is not popped
loses the instrument silently. Say so in every worker brief.

#### Open items — the live map is the record's §7

`docs/decisions/2d-6-split-notes.md` §7 states, per item, whether the consult **took it into 2d-6** (obligations
(1)-(3), open items 5, 6, 8, 9), **deferred it** (1 — the `file:line` drift checker; 7 — the `"permissions": []`
comment in `main.rs`, 2d-8's; 10 — the `dispose()`-on-close path) or **left it untouched** (0, 2, 3, 4, 11). Two
facts the consult item did not anticipate, now bound by rulings: **native watcher degradation is not on the
wire** (`WatchStatusView` is read by `watch_check` alone), and `BrowserState` exposed neither `watchState()` nor
its registration — **1c discharged that one** (item 11: `reconciliationWatchState()`,
`reconciliationRegistration()`). Obligations (2) and (3) of the 2d-5 hand-off — the two-exit uncertainty rule
and the two-release retained rule — are **discharged by 1b** in the code's own doc comments (the third exit is
the acknowledgement, the third release the person's retry; notes §2).

#### The rest of the 2d consult, so a step is not invented

**2d-6** (its eleven steps; 2d-6-1 closed as three sub-phases, 2d-6-2 next), **2d-7** (the reviewed instrument
and the bilingual WKWebView reading — start from the `fetch` recorder already in `src/probe.ts`, not from the
consult's description), **2d-8** (instrument removal and harness-free closure; corrects the `main.rs` comment
and deletes `/private/tmp/espansoconfig-harness-2d-5-7b/`).
---

## Verification baseline

### Phase 2d-6-1c's verification: three frontend gates re-measured twice, the Rust cell held

**`1323 / 447 / 2574 / 192`** at 2d-6-1c, from `1323 / 447 / 2549 / 192`. Measured by the orchestrator on the
tree the worker reported (`2570`) and again on the final tree after the review's fix round (`2574`), each gate
on its own, each exit read directly (never through a pipe): `npm run check` **447 files, 0 errors, 0 warnings**
(unchanged — no new file); `npm test` **2574 passed, 64 files** (+25 from 2549, re-derived per file and each run
alone to confirm: `workspace.test.ts` 274 → 288 and `reconciliationCoordinator.test.ts` 62 → 73 — +21 for the
four deliverables, then +4 pinning the review's two findings and the sibling site; `ipc-detail` 141 → 141, no
new `.ts` file); `npm run build` **192 modules** (unchanged), the server-only bundle markers **absent** (`rg -l`
lists no file, exit 1) and the client-only **present (2)**. **The Rust cell is held at 1323 and was not
re-measured**: no path under `src-tauri/` or `crates/` changed beyond the instrument's `main.rs` hook, whose
pair diff is still `5 insertions(+), 1 deletion(-)`; the instrument's contribution is unchanged (Rust 0,
svelte-check +1, vitest +1, Vite +1). 2d-6-1b's narrative, formerly here, is archived verbatim in
[`phase-2d.md`](docs/progress-archive/phase-2d.md) under *"Phase 2d-6-1b's verification narrative"*.

### The ladder's live rung

**`1323 / 447 / 2574 / 192`** at 2d-6-1c, **with the instrument in the tree** (a committed tree builds 191
modules). The rung below it is `1323 / 447 / 2549 / 192` at 2d-6-1b, below that `2520` at 2d-6-1a, below that
`1323 / 444 / 2474 / 191` at 2d-5-7a, held through 2d-5-7b and the 2d-6 design consult; below that
`1320 / 443 / 2467 / 189` at 2d-5-6, below that `2466` at 2d-5-5b, `2433` at 2d-5-5a and `2415` at 2d-5-4-G,
with the seven below that running `2413 / 2409 / 2406 / 2404 / 2395 / 2389 / 2380` across 2d-5-4-F … 2d-5-4.
Below them is `1320 / 441 / 2307 / 188`, held from 2d-5-3-A to 2d-5-3-N. **The instrument landed at 2d-5-2c-1**,
whose rung was `1320 / 439 / 2255 / 187`, so every rung at or after it is a *with-instrument* figure and the two
groups may not be compared without subtracting the instrument's known contribution (one Vite module, one
`ipc-detail` row). Full per-rung list, 2d-5-6's narrative: [`phase-2d.md`](docs/progress-archive/phase-2d.md).
### The superseded baseline blocks, the pre-instrument baseline and the flaky-gate finding

Archived verbatim 2026-09-21 at 2d-6-1b to [`phase-2d.md`](docs/progress-archive/phase-2d.md) under *"The
superseded-baseline preamble, the pre-instrument baseline block and the flaky-gate finding"*. Two facts a
later phase reads from them: **the last baseline measured before the instrument landed is `1320 / 438 /
2254 / 186`** (2d-6-11's with-and-without-instrument accounting compares against it), and **`cargo test
--workspace` is flaky on this host alone — `--test-threads=1` is the authoritative form** (`CLAUDE.md` §4;
a parallel run that fails only `watch_check` says nothing about source).

### Where the closed rounds' verification narratives went

Round 13's block, rounds 9-12 and Phase M2's are in
[`docs/progress-archive/phase-2d.md`](docs/progress-archive/phase-2d.md) under *"the verification
narratives, archived 2026-08-30"*. **No round of the 2d-4a tail moved a count and none can now.**
**2d-5-3-M's verification narrative and ladder section** are in the same file under *"Phase 2d-5-3-M's
verification narrative and ladder section — archived 2026-09-20 at Phase 2d-5-3-N"*, with one
correction in that entry's header; every earlier rung of the 2d-5-3 ladder is under the 2d-5-3-M
archive heading beside it.
---

## Key paths

The full path index, with a paragraph on why each mattered to its phase, is in
[`docs/progress-archive/status-table.md`](docs/progress-archive/status-table.md) and the phase files
beside it. These are the ones the next phase needs.

| Path | Why it matters next |
|---|---|
| [`docs/decisions/2d-5-7b-window-reading.md`](docs/decisions/2d-5-7b-window-reading.md) · `/private/tmp/espansoconfig-harness-2d-5-7b/` · `src/probe.ts` (uncommitted) | **The window reading that closed 2d-5, and the instrument 2d-7 starts from.** §3 is the `fetch` recorder, §4 the twelve launches with verbatim transcript lines, §5 what is not proved (disposal on close, wake delivery by timing only), §10 where it is thin. The harness is outside the repository and is deleted by 2d-8; `HARNESS_ROOT` in `src-tauri/src/probe.rs` must agree with `launch.sh`'s `HARNESS` |
| [`docs/decisions/2d-4-split-notes.md`](docs/decisions/2d-4-split-notes.md) | **2d-4b's whole spec is §2.** §3 says why the EN/ES JSON landed in 4a and the accessors in 4b; §4 says what neither step does. Read this before the design consult, not after |
| [`docs/reviews/phase-2d-5-design.md`](docs/reviews/phase-2d-5-design.md) · [`docs/decisions/2d-5-split-notes.md`](docs/decisions/2d-5-split-notes.md) · [`docs/decisions/2d-5-design-brief.md`](docs/decisions/2d-5-design-brief.md) | **2d-5's binding rulings, its record and the brief that produced them.** Read the consult first, then the record's §5 corrections — the consult overrides `phase-2d-design.md` step 5 in two places. §6 carries seven unsettled items, §7 the inherited drain-guard counts |
| [`docs/reviews/phase-2d-6-design.md`](docs/reviews/phase-2d-6-design.md) · [`docs/decisions/2d-6-split-notes.md`](docs/decisions/2d-6-split-notes.md) · [`docs/decisions/2d-6-design-brief.md`](docs/decisions/2d-6-design-brief.md) · [`docs/reviews/phase-2d-6-design-record-review.md`](docs/reviews/phase-2d-6-design-record-review.md) | **2d-6's binding rulings, its record, the brief that produced them, and the record's review.** Read the consult first, then the record's §5 nine corrections — the consult overrides `phase-2d-design.md` item 6 and `2d-5-split-notes.md` where they disagree. §2 is the eleven-step split with each step's scope, acceptance and binding entries; §7 is the live map of the handed-on obligations and open items 0-11 |
| [`docs/decisions/2d-6-1c-notes.md`](docs/decisions/2d-6-1c-notes.md) · [`docs/reviews/phase-2d-6-1c.md`](docs/reviews/phase-2d-6-1c.md) | **What 2d-6-2 reads from the last third of 2d-6-1.** §1 the member names with signatures, refusal reasons and line numbers (`reconciliationRevision()`, the two reload requests, `requestFileReread` and `ownedScalarOf` at ingress); §2 the seven rulings taken there (host member over constructor option; membership permitted when not "wanted"; lost-history refuses `notBlocked` while running; `ReconciliationWorkspace` not widened); §3 the whole 2d-6-1 acceptance checked in one place; §5 the open items it left; §6 the two findings re-derived, with the pre-fix failures verbatim |
| [`src/lib/browser/reconciliationCoordinator.ts`](src/lib/browser/reconciliationCoordinator.ts) · [`src/lib/browser/reconciliationCoordinator.test.ts`](src/lib/browser/reconciliationCoordinator.test.ts) | **2d-5-3's product, and what 2d-5-3-A reviews.** The single-flight pump, `drainMayStart()` and its four readers, the `openInProgress` gate set by `workspaceOpened()` and cleared by `workspaceReady()`, `runOneDrain()`'s captures and its post-await `staleOpen` arm, the cursor and `watchState()`. **2d-5-4 replaces the one line in `accept()` that drops a batch's observations**, and 2d-5-4/2d-5-5 give `transitionFor` its first caller |
| [`docs/reviews/phase-2d-5-3.md`](docs/reviews/phase-2d-5-3.md) · [`docs/decisions/2d-5-3-notes.md`](docs/decisions/2d-5-3-notes.md) | **The review 2d-5-3-A answers, and the record it must be checked against.** The review is this chain's first `do-not-ship`; the notes' new §8 is the fix round, and its *where it is thin* section carries two `recorded only` items a reviewer should read before spending budget on them — nothing pairs `workspaceOpened()` with `workspaceReady()` in the type system, and no test drives the gate through a real `open()` |
| [`docs/reviews/phase-2d-5-2a.md`](docs/reviews/phase-2d-5-2a.md) · [`docs/decisions/2d-5-2a-notes.md`](docs/decisions/2d-5-2a-notes.md) | Historical — the 2d-5-2a chain is closed. **What 2d-5-2a-A fixed and re-reviewed.** The review's three SHOULD-FIX findings are transcribed in full under *Next action*; the notes' §3.5 and §7 item 4 are where finding 1's overclaim is repeated, and §7's seven marked items are what §7.3 was applied to |
| [`src/lib/browser/writeSurfaceRegistry.ts`](src/lib/browser/writeSurfaceRegistry.ts) · [`src/lib/browser/writeSurfaceRegistry.test.ts`](src/lib/browser/writeSurfaceRegistry.test.ts) | **2d-5-2a's product, and what 2d-5-2b registers into.** The lease, the generation, the reader's order and `transitionFor` (stored, never invoked until 2d-5-4/5). Findings 1 and 3 both live here, and both are the same discipline: never re-read a caller-supplied property after acting on it |
| [`src/lib/components/DetailPane.svelte`](src/lib/components/DetailPane.svelte) · [`src/lib/components/MatchCreator.svelte`](src/lib/components/MatchCreator.svelte) | **2d-5-2b's two components.** The `satisfies Record<OpenWriteSurfaceKind, …>` assembly goes in the pane — it is the *only* thing that makes omitting a declared kind a compile error — and the creator reports its chosen destination upward through the lease. `openWriteSurfaces()` and `invalidateEverySurface` both live in the pane and both are named above |
| [`docs/decisions/2d-5-1-B-notes.md`](docs/decisions/2d-5-1-B-notes.md) · [`src/lib/browser/restore.ts`](src/lib/browser/restore.ts) | **The vocabulary 2d-5-2 registers.** `restore.ts` holds `OpenWriteSurfaceKind`, `WriteSurfaceTarget`, `OpenWriteSurface`, `competingSurfaceFor` and `targetingSurfaceFor`, all shipped at 2d-5-1 and none of them 2d-5-2's to change. Historically, also what 2d-5-1-C reviewed: The notes' §3 is the one comment under review and the four claims it makes; §5 corrects a line citation in round B's own report (`:625` named the `default:` arm, not the exact-match return); §6 is the argument for when this tail stops being a tail and becomes `BLOCKED`. The comment itself is `restore.ts:608-617` |
| [`docs/reviews/phase-2d-5-design-record-review.md`](docs/reviews/phase-2d-5-design-record-review.md) | The consult phase's own review — `ship-with-fixes`, 0 blockers. **Three of its five findings were caused by an orchestrator header edit landing after a figure had been derived from the file**, which is the shape to watch for, not the specific rows |
| [`docs/reviews/phase-2d-design.md`](docs/reviews/phase-2d-design.md) | The consult that shaped Phase 2d into eight steps, and Q8's sharpest green-suite failure. **Superseded for 2d-5 by the row above** wherever the two disagree |
| [`docs/reviews/phase-2d-4b-design.md`](docs/reviews/phase-2d-4b-design.md) · [`docs/decisions/2d-4b-notes.md`](docs/decisions/2d-4b-notes.md) · [`docs/reviews/phase-2d-4b.md`](docs/reviews/phase-2d-4b.md) | **2d-4b's binding rulings, its record and its one review.** The consult is the acceptance standard; the notes' §5 is the fix round 2d-4b-B reviews and §7 the six residues that are *not* findings |
| [`src/lib/ipc/events.ts`](src/lib/ipc/events.ts) · [`src/lib/ipc/types.ts`](src/lib/ipc/types.ts) · [`src/lib/ipc/commands.ts`](src/lib/ipc/commands.ts) | **What 2d-4b built.** The injectable event source (imported by nothing yet, deliberately), the reconciliation mirror, and `drainExternalChanges` — which owns no watermark and compares no epoch, because that is 2d-5's |
| [`src/lib/i18n/codes.ts`](src/lib/i18n/codes.ts) | `CODE_NAMESPACE_KEY_BUILDERS` is the general key-without-accessor check — **function references, never namespace strings** — with exactly three exceptions. A new dictionary namespace now fails until it has an accessor |
| [`src-tauri/capabilities/default.json`](src-tauri/capabilities/default.json) | `"permissions": []`. **The phase that first registers a listener must add both `core:event:allow-listen` and `core:event:allow-unlisten`** and re-run `dispatch_check.rs`; listen and unlisten are separate plugin commands behind separate permissions |
| [`src/lib/ipc/commands.ts`](src/lib/ipc/commands.ts) · [`src/lib/browser/workspace.svelte.ts`](src/lib/browser/workspace.svelte.ts) | **Where 2d-4b writes.** The TypeScript side of the wire, and the coordinator every write surface goes through — the `BrowserCommands` drain wrapper and the injectable event-listener wrapper belong here |
| [`src/lib/i18n/codes.ts`](src/lib/i18n/codes.ts) · [`src/lib/i18n/index.ts`](src/lib/i18n/index.ts) | The twelve typed `describe*` builders and their reactive `t*` wrappers — **2d-4b adds to both files.** A component renders a code by calling an accessor, never by building a key |
| [`docs/decisions/2d-4a-notes.md`](docs/decisions/2d-4a-notes.md) | 2d-4a's record, now **closed**. **§22 is round 13 and the closure**, §21 round 12, §20 round 11, §19 round 10, §18 round 9, §15 the round-6 fix, §9 the residues. §22.4 lists what the closed tail leaves behind, each marked per §7.3 |
| [`docs/reviews/phase-2d-4a-round-13.md`](docs/reviews/phase-2d-4a-round-13.md) · [`docs/decisions/2d-4a-H-round-13-brief.md`](docs/decisions/2d-4a-H-round-13-brief.md) | The round that closed the tail, and the brief that asked for it. **The brief is the shape to copy** if a later phase needs an adversarial round: it names the coverage bound to the reviewer rather than hiding it, tells the round which declined finding not to spend budget on, and asks for figures to be *re-derived* rather than re-read |
| [`docs/decisions/codex-dispatch-procedure.md`](docs/decisions/codex-dispatch-procedure.md) | Read **only if** a later phase decides to break the **seven**-round consecutive-Opus run, which 2d-4a's closure did **not** discharge. A `/goahead` procedure, not an `/autoclaude` one |
| [`docs/decisions/2d-4a-round-7-brief.md`](docs/decisions/2d-4a-round-7-brief.md) | Round 7's brief, now spent — but **2d-4b's four inherited constraints are still live at its end** |
| [`docs/reviews/phase-2d-4a-queue.md`](docs/reviews/phase-2d-4a-queue.md) | 2d-4a's work list — rounds 1–8 verbatim, newest last. **Round 9 is deliberately not in it**, and the file says why: the queue preserves replies that lived only in a transcript, and round 9's reviewer wrote its own file |
| [`docs/decisions/2d-4a-C-notes.md`](docs/decisions/2d-4a-C-notes.md) | The mechanism's record; §25 is round 9, §26 and Appendix A the reorganization, §24.7 the gate table |
| [`docs/reviews/phase-2d-4a-C.md`](docs/reviews/phase-2d-4a-C.md) | Step 1 rounds 1–4 and step 2 rounds 1–9, each verbatim |
| [`docs/decisions/2d-3-C-notes.md`](docs/decisions/2d-3-C-notes.md) | The precedent for ending a tail, and §4.4 is the proof-it-fails evidence standard |
| [`src-tauri/src/prose_sweep.rs`](src-tauri/src/prose_sweep.rs) | The shared sweep machinery both contract checks use; its module doc states the family's limits |
| [`src-tauri/src/retained_state_contract.rs`](src-tauri/src/retained_state_contract.rs) | The retained-state guard 2d-4a-C-2 built |
| [`src-tauri/src/liveness_contract.rs`](src-tauri/src/liveness_contract.rs) | The sibling guard and the working template for both |
| [`crates/espansoconfig-core/src/watch/retained_state.rs`](crates/espansoconfig-core/src/watch/retained_state.rs) · [`liveness.rs`](crates/espansoconfig-core/src/watch/liveness.rs) | The two contracts those checks enforce |
| [`src-tauri/src/commands.rs`](src-tauri/src/commands.rs) · [`save.rs`](src-tauri/src/save.rs) | The twelve commands; `run_one_save` holds the layer's single cache-coherency policy |
| [`src-tauri/src/wire_contract.rs`](src-tauri/src/wire_contract.rs) · [`dictionary_contract.rs`](src-tauri/src/dictionary_contract.rs) | The two exhaustiveness checks a new wire type or code must satisfy |
| [`src/lib/browser/saveOutcome.ts`](src/lib/browser/saveOutcome.ts) · [`editorSave.ts`](src/lib/browser/editorSave.ts) | `conflictChoicesFor` is the only producer of a choice list; `adoptDiskVersion` is the only confirmed-install door |
| [`crates/espansoconfig-core/src/persist/write.rs`](crates/espansoconfig-core/src/persist/write.rs) | `save_document` is the only entry point that may write a user's file |
| [`docs/parser-evaluation.md`](docs/parser-evaluation.md) · [`docs/decisions/0c-3b-2b-notes.md`](docs/decisions/0c-3b-2b-notes.md) | The substrate verdict, and the Phase 0 gate verdict with its evidence |
| [`scripts/sync-real-corpus.sh`](scripts/sync-real-corpus.sh) · [`scripts/build-byte-exact-fixtures.sh`](scripts/build-byte-exact-fixtures.sh) | The gitignored real corpus, and the five script-built byte-exact fixtures |
| [`vite.config.ts`](vite.config.ts) | `resolve.conditions` is set conditionally, and that is load-bearing |
| [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md) · [`CLAUDE.md`](CLAUDE.md) | The plan of record, and the rules that bind every session |

---

## Git state

_The 2026-09-20 by-hand batch — the `CLAUDE.md` §7 review-rule removal, the withdrawal of 2d-5-4-H,
`docs/progress-archive/claude-md-2026-09-20.md` and the kept review `docs/reviews/phase-2d-5-4-H.md`
— **went in at `25c44f7`** and this note is kept only so a reader of the log knows which commit
carried it. **The four instrument paths are the only thing that stays dirty**, deliberately and
permanently until 2d-8 deletes them._

_Updated at each phase boundary. Only the rows of the **live** chain are kept here. Every closed
chain's rows and the prose that argued them are in
[`docs/progress-archive/status-table.md`](docs/progress-archive/status-table.md), under *"The
git-state rows of the closed 2d-4a and 2d-4b chains"* and *"The git-state rows of the closed 2d-5-1
and 2d-5-2a chains"*; older still is
[`docs/progress-archive/next-action-history.md`](docs/progress-archive/next-action-history.md), and
all of it is in `git log`._

| Phase | Commit | Push |
|---|---|---|
| _2d-4a through 2d-4a-H, and 2d-4b through 2d-4b-H — **both chains closed**, 37 rows_ | `eced554` … `998e346` | ✅ all pushed; **archived 2026-09-04** |
| **2d-5 design consult (brief, Codex consult, record, review — four new files, all under `docs/`, no source touched)** | **`5787e87`** | ✅ pushed to `origin/main` |
| 2d-5 design consult — the SHA and push record | `32ffcfc` | ✅ pushed to `origin/main` |
| _2d-5-1 through 2d-5-1-C, and 2d-5-2a through 2d-5-2a-C — **both chains closed**, 14 rows including one checkpoint-maintenance commit_ | `16a122b` … `0f1ad8b` | ✅ all pushed; **archived 2026-09-04 at 2d-5-2b** |
| _2d-5-2b through 2d-5-2b-E, and 2d-5-2c-1 and 2d-5-2c-2 with their SHA records — **the whole 2d-5-2 chain, closed**, 15 rows_ | `505caf6` … `0f4cfbc` | ✅ all pushed; **archived 2026-09-05 at 2d-5-3**, under *"The git-state rows of the closed 2d-5-2b and 2d-5-2c chains"* |
| _2d-5-3 through 2d-5-3-N — **the whole 2d-5-3 chain, closed**, 22 rows including six SHA-and-push records_ | `332a751` … `a8bb43f` | ✅ all pushed; **archived 2026-09-20** to [`status-table.md`](docs/progress-archive/status-table.md) under *"The git-state rows of the closed 2d-5-3 chain"* |

| _**2d-5-4** through **2d-5-4-G** — **the whole 2d-5-4 chain, closed**, 8 rows: the observation state transitions and the seven §7.1 rounds over them. Every round `ship-with-fixes` by **Codex**, every finding re-derived before it was fixed, the rung climbing `2380 → 2415` with the other three figures never moving. The chain's product is `src/lib/browser/observationTransitions.ts`_ | `81e54db` … `ff183e1` | ✅ all pushed; **archived 2026-09-21 at 2d-5-5a** to [`status-table.md`](docs/progress-archive/status-table.md) under *"The git-state rows of the closed 2d-5-4 chain"* |
| _**2d-5-5a**, **2d-5-5b**, **2d-5-6**, **2d-5-7a** and **2d-5-7b** — the close of 2d-5, five rows, every review `ship-with-fixes` by **Codex**, every finding re-derived before it was fixed, the rung climbing `2415 → 2474`_ | `20ff191` … `6467ba8` | ✅ all pushed; **archived 2026-09-21 at 2d-6-1a** to [`status-table.md`](docs/progress-archive/status-table.md) under *"The git-state rows of the closed 2d-5-5a … 2d-5-7b chain"* |
| **2d-6 design consult — brief, Codex consult, record, the record's review; four new files under `docs/` plus this checkpoint pair, no source touched.** Also archives the superseded 2d-5-7b Next-action handoff (161 lines) to `next-action-history.md` and 2d-5-7b's verification narrative (15 lines) to `phase-2d.md`. Stages `PROGRESS.md`, `PROGRESS.json` and `docs/` **by path**; the four instrument paths stay uncommitted | **`2de66e2`** | ✅ pushed to `origin/main` (`f46f52a..2de66e2`); this SHA record is the following commit |
| **2d-6-1a — delivery values, shared conflict primitives and origin-correct messages, the first third of 2d-6-1.** `observationDelivery.ts` (envelope, `decideAutomaticReload`), `conflictRevisionsOf` and the two parent-narrowing guards in `conflictSource.ts`, `describeExternalConflict` emitting `fileChangedWhileOpen` over a first-element-forced tuple in `saveOutcome.ts`, four `browser.externalConflict.*` keys with accessors and literal EN/ES pins, ruling 24's five rewordings. Review **Codex, `ship-with-fixes`, 0 blockers, 3 SHOULD-FIX**, all re-derived, all held, all fixed in this commit. New rung `1323 / 447 / 2520 / 192`. Also records the three-way cut in `2d-6-split-notes.md` §2 and archives the superseded Next-action handoff (75 lines) and the consult's verification narrative (12 lines). Stages `PROGRESS.md`, `PROGRESS.json`, `docs/`, `src/lib/browser/` and `src/lib/i18n/` **by path** — **no path under `src-tauri/` at all**; the four instrument paths stay uncommitted | **`e88498d`** | ✅ pushed to `origin/main` (`5932b83..e88498d`); this SHA record is the following commit |
| **2d-6-1b — the observation-protocol members on `BrowserState`, the second third of 2d-6-1.** `observeExternalChange` delivering a sealed envelope, settlement published from the lease's `close()`, `registerObservationReceiver`, `retryRetainedObservation`, the branded one-shot `acknowledgeWriteUncertainty`, `automaticReloadGuardFor`, the seventh verdict arm `writtenHere`, the entry 41 corrections. Review **Codex, `ship-with-fixes`, 1 BLOCKER, 2 SHOULD-FIX**, all re-derived, all held, all fixed in this commit with six pinning cases. New rung `1323 / 447 / 2549 / 192`. Also archives the superseded Next-action handoff and 1a's verification narrative. Stages `PROGRESS.md`, `PROGRESS.json`, `docs/`, `src/lib/browser/` and `src/lib/i18n/` **by path** — **no path under `src-tauri/` at all**; the four instrument paths stay uncommitted | **`874f0ae`** | ✅ pushed to `origin/main` (`99806b6..874f0ae`); this SHA record is the following commit |
| **2d-6-1c — the coordinator and workspace members on `BrowserState`, the last third of 2d-6-1, which closes with it.** `ReconciliationHost.reconciliationChanged()` and `reopenFromRetainedRequest()` on the coordinator; `reconciliationRevision()`, `reconciliationWatchState()`, the sanitized `reconciliationRegistration()`, `requestMembershipReload()`, `requestLostHistoryRecovery()` and `requestFileReread()` on `BrowserState`; `ownedScalarOf()` copying every top-level key at ingress; the entry 41 corrections. Review **Codex, `ship-with-fixes`, 1 BLOCKER, 1 SHOULD-FIX**, both re-derived, both held, both fixed in this commit with one sibling site and four pinning cases. New rung `1323 / 447 / 2574 / 192`. Also archives the superseded Next-action handoff and 1b's verification narrative. Stages `PROGRESS.md`, `PROGRESS.json`, `docs/` and `src/lib/browser/` **by path** — **no path under `src-tauri/` at all**; the four instrument paths stay uncommitted | _(this commit — SHA recorded in the following commit)_ | _pending_ |
_The round-by-round §7.1 reading for the closed 2d-5-2b chain, the hatch condition C set and D
applied, what the five rounds bought, and the stale-citation sweep taken while E ran, are in
[`status-table.md`](docs/progress-archive/status-table.md) under *"The git-state prose of the closed
2d-5-2b chain"*, archived 2026-09-05. `docs/decisions/2d-5-2b-notes.md` §13-§17 is the authoritative
per-round record. The one finding that outlived that tail — **four stale cross-file citations in
`src/`** — is live in *Next action* above, as a candidate corrective phase._
