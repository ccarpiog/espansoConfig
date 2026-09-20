# PROGRESS — espansoConfig

**This file is the authoritative project state, and it is the live head only.** The conversation is
not project state: a fresh session must be able to resume from this file alone, with no conversation
history.

**Its size budget is 400 lines / 64 KiB soft and 800 / 128 KiB hard**, and a session resuming onto a
file over the hard bound archives first, before anything else. It carries the phase table, the
standing rules, the open risks, the next action, the verification baseline, the key paths and the git
head. Everything a closed phase left behind — its narrative, its verification sections, its review
dispositions and every superseded handoff — is in the archive, and **a phase closing is what
triggers the move**. **Two moves landed on 2026-09-04**, both into
[`docs/progress-archive/status-table.md`](docs/progress-archive/status-table.md): the 37 closed
git-state rows of the 2d-4a and 2d-4b chains with the prose arguing them, and then — the moment the
2d-5-1 tail closed, rather than at the bound — that chain's own four status rows. Each leaves one
summary row and a pointer. **The figures below are
re-measured on the file that carries them**, because a header quoting the size of the file
it replaced has already had to be corrected twice, and 2d-4b-D found the identical shape in a notes
section's line citations. **That failure recurred at the 2d-5 consult in a new place**: a citation
column derived from `docs/reviews/phase-2d-5-design.md` was left behind by two later edits to that
file's header, and only a reviewer re-deriving it noticed. A derived figure outlives the thing it was
derived from unless something re-derives it.

**Where the headroom stands, re-derived on this file after this round's record was written — never
before it, and never quoted from the header it replaces:** **690 lines and 129857 bytes**,
which is **113 lines and -461 bytes under the hard bounds** (800 / 131,072) and over both soft
ones (400 / 65,536). **The figure is a fixed point, not an estimate**: substituting it changes the
file's size, so it was substituted and re-measured until it stopped moving, and it is re-derived once
more in the SHA-record commit, which edits the git-state row **in place**.

**2d-5-4 crossed the byte bound and had to archive twice**, which is the first time that has happened
since the split: four narrative archives (131 lines) left it at **133,021 bytes — 1,949 over** — because
an implementation phase's record is longer than a review round's, and only then did the two oldest
superseded rows come out of reserve. **Measure after writing, not before, and expect an implementation
phase to need a row.**

**⛔️ The byte bound binds first; the line bound does not.** The status and git-state rows are single
lines of two to four thousand bytes each, so a session watching only lines will misjudge the room.
**Measure both, on this file, after writing.** **2d-5-3-N took two narrative archives before a word of
the record** — 38 + 25 lines, the verification narrative and the ladder section — **plus this header's
own two paragraphs, and no status row**; 2d-5-3-M took three and compressed the ladder to its live
rung, and 2d-5-3-L took four. **Four superseded rows are now in reserve, J's, K's, L's and M's**, and
the 2d-5-3 tail being closed, they are settled state a later step may move. **The measurement is taken
after the writing, never predicted before it.**

**What may not be archived to make room**, both live for a reason a later session would otherwise have
to rediscover: the flaky-`cargo test` section under *Verification baseline* — every one of its three
consequences was followed this session and the gate is clean because of them — and the pre-instrument
production baseline, which is the figure 2d-5-7 compares against.

**Three rules this file's archive history established, kept here because they are rules; the
arithmetic that established them is archived.** Sixty-seven lines of narrative about the archives
already taken for the closed 2d-5-1, 2d-5-2a and 2d-5-2b chains are in
[`phase-2d.md`](docs/progress-archive/phase-2d.md) under *"`PROGRESS.md`'s archive arithmetic … archived
2026-09-05 at Phase 2d-5-3-D"*, with one correction marked at the top. What survives it:

1. **Archive on state, not on length.** A row moves when its own state says it may — see rule 2 for
   what that means for a chain that is still live — never because this file got long.
2. **What rule 1 refuses is archiving a live chain's *head*, and this is a correction.** The sentence
   here used to read *"a chain's rows move when the chain closes"*, and **this chain has twice done
   otherwise on purpose**: 2d-5-3-C archived the rows of 2d-5-3, -A and -B, and 2d-5-3-J archived
   C through F, each time leaving one summary row and each time while the chain was live. What both
   moved were rows already **`SUPERSEDED` by the next link** — a settled state, not a length problem.
   2d-4b-G's refusal is still the precedent it always was, and it is about the **head**: it wanted a
   live chain's rows because they were the longest thing in the table, which is archiving on length,
   and that is how a live chain loses its head. **Superseded rows may move; the head may not.**
3. **The archive slows a live chain's growth and rarely reverses it.** The head had fallen exactly
   when a chain closed and risen every other time — 788 → 790 at 2d-5-3-D, across an archive of 130
   lines — until **2d-5-3-J took five and finished under its inherited size on both bounds**, which
   took the superseded-row move of rule 2 on top of four narrative archives. Four alone left it 4,733
   bytes up. **A session that closes a 2d-5 step should archive that step's narrative as it goes**,
   rather than at the bound.

- Plan of record: [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md) (§12 holds the phase plan).
- Phase summary: [`PROGRESS.json`](PROGRESS.json), rewritten from this file after every phase and
  never read for a decision; where the two disagree this file is right and the JSON is rewritten from
  it. Since 2d-5-3-L it is on `CLAUDE.md` §7's closed list of record entries.
- Rules that bind every session: [`CLAUDE.md`](CLAUDE.md).
- Everything a closed phase left behind:
  [`docs/progress-archive/README.md`](docs/progress-archive/README.md), which indexes
  `status-table.md`, `completed.md`, `decisions.md`, `phase-0.md` … `phase-2d.md`,
  `2d-4a-c-closure.md` and `next-action-history.md`.

**`next-action-history.md` is history, never an instruction.** Several of its entries say "THE NEXT
ACTION IS …" in bold capitals about work that is long finished. The only live next action is the one
in this file.

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
| **2d-5** | The browser coordinator and the open-write-surface registry — seven steps, of which two touch components | 🔶 in progress — **steps 1, 2 and 3 of 7 are complete and CLOSED**, tails and all. **Step 3's tail ran fourteen rounds, `2d-5-3-A` … `2d-5-3-N`, each commissioned by its predecessor's fix, and it ended by rule**: 2d-5-3-N's fix changed no source file, so `CLAUDE.md` §7.1 commissioned nothing and §7.2 closed the step — **the fourth tail this project has ended by rule and the longest of them**, with no owner ruling and no human stopping it. Its last three rounds were **two providers**, the `autoclaude-reviewer` agent then Codex twice. **The executable product was written once**: `332a751` is the last commit to change a non-comment line of `reconciliationCoordinator.ts`, and all thirteen lettered rounds changed zero, so the tail was fourteen rounds about whether the comments tell the truth. Step 2 was split three ways and its third part split again. **Step 4 is complete as of 2d-5-4** — the first new implementation work since 2d-5-3 and the first phase in fifteen to change a line that is neither comment nor blank: `observationTransitions.ts` is new, and the rung moved off `1320 / 441 / 2307 / 188` for the first time since 2d-5-2c-1. Its review was **Codex, `ship-with-fixes`, 2 blockers and 3 SHOULD-FIX, all five re-derived and all five holding**; the two blockers were a comment claiming an atomicity the code did not give and a guard missing the question *is this coordinator still applying at all*. **Its fix changed six source files, so §7.1 commissions Phase 2d-5-4-A**, which is the next action |
| **2d-5-4** | The observation state transitions — the per-document accepted-sequence map, the guarded reread, the `Added`/`Removed`/`Unreadable` arms, the selected-document removal, `Addressable`-only command routing and the discarded-history recovery. **Components: none**, with one comment-only exception the phase did not plan | ✅ **complete**, every gate green at the new rung `1320 / 443 / 2380 / 189` — the frontend three read **four times**, the Rust one measured on a tree `git diff --numstat` proves holds no changed Rust. Risk class **high**; worker model **opus** (two workers — the build, then the review's fix round). **Verdict `ship-with-fixes`, 2 blockers**, 3 SHOULD-FIX; **the report's finding bodies arrive truncated again**, so **none of the five was accepted on the report's strength** — all five were re-derived from the code by the orchestrator and all five held. Blocker 1: `rereadUnderGuard`'s JSDoc claimed the final check and the installation had *nothing between them* while `fresh.value` — a property read on **injected** data — was read twice after it; fixed by materializing once, and the comment now states the **shallow** copy it is and what that leaves unbounded. Blocker 2: the guard's four questions never asked whether the coordinator was still applying, so a reread in flight installed and **cleared the stale mark** during `blockedByLostHistory` when recovery had declined, and another installed after `dispose()`; fixed by `stillApplying()`, asked first, whose refusal marks stale and never clears. The three SHOULD-FIX: pending `Added` identities reached document commands through `rawTarget` (a route around ruling 28), the fire-and-forget reread's failure was invisible behind an already-advanced accepted sequence, and **ruling 28's negative half was measured to be vacuous** — its baselines were captured after the batch, so an injected erroneous `get_document` passed. **The fix changed six source files, so §7.1 commissions a round.** Notes `docs/decisions/2d-5-4-notes.md`; review `docs/reviews/phase-2d-5-4.md` |
| **2d-5-4-A** | The round `CLAUDE.md` §7.1 commissioned for 2d-5-4's fix — scoped to the six source files that fix changed and to `2d-5-4-notes.md`'s correction blocks. **Components: none** | 🔶 round taken and answered, every gate green at `1320 / 443 / 2389 / 189` on the tree it commits, and **`SUPERSEDED BY 2d-5-4-B`, never recorded as complete**. Risk class **high**; worker model **opus** (review by **Codex**, `autoclaude-review.sh` exiting 0 so no agent was spawned — three consecutive Codex rounds; one read-only re-derivation worker, then one fix worker). **Verdict `ship-with-fixes`, 2 blockers**, 4 SHOULD-FIX, **all six re-derived before any was fixed and all six holding**, five in source and one in the record **and** in source. The two blockers were one defect: `open()` retained the commands' own projection objects, so `installView`'s `id` comparison and `repairAfter`'s reads of `next.matches` ran caller-controlled accessors **after** the final guard — and 2d-5-4's fix had written into source that `replaceSelection` bounded the repair, which it does not. Fixed at **ingress**, by a field-by-field `ownedProjectionOf` at all nine of them. Three of the four SHOULD-FIX were one defect too — a status write that never asks whether it still owns the status — fixed by a per-document write token, by fencing the two guard arms above the ownership question without touching the decision order, and by moving the clear into the installation block, which is what lets an explicit reread clear a mark that had been permanent. The fourth was a reachability claim false in **both** the record and source. **The fix changed four source files, so §7.1 commissions a round.** Notes `docs/decisions/2d-5-4-A-notes.md`; review `docs/reviews/phase-2d-5-4-A.md` |
| **2d-5-4-B** | The round `CLAUDE.md` §7.1 commissioned for 2d-5-4-A's fix — scoped to the four source files that fix changed and to its correction blocks in `2d-5-4-notes.md`. **Components: none** | 🔶 round taken and answered, every gate green at the new rung `1320 / 443 / 2395 / 189` on the tree it commits, and **`SUPERSEDED BY 2d-5-4-C`, never recorded as complete**. Risk class **high**; worker model **opus** (review by **Codex**, `autoclaude-review.sh` exiting 0 so no agent was spawned — **four consecutive Codex rounds**; one read-only re-derivation worker, then one fix worker). **Verdict `ship-with-fixes`, 2 blockers**, 4 SHOULD-FIX, **all six re-derived before any was fixed and all six holding**, five in source and one in the record — and **three more the review missed**, each a generalization of a finding it had made. Both blockers are 2d-5-4-A's own defect one level down or one step later: `open()` normalizes **after** its last generation check, so the **final** document's getters and the injected `report` run between that check and `status = 'ready'` — a re-entrant `open()` watched the superseded configuration install itself and open the drain gate — and `ownedMatchOf` kept `id: match.id`, so `positionOf`'s `match.id.node` read sits between the three adoptions' identity guard and their `replaceSelection`. Fixed by a second generation check after the loop, by `ownedMatchIdOf` and by `ownedIdentityOf` for the `target`/`moved` a save answer carries. Three SHOULD-FIX were one question — *does this writer still own what it is writing?* — answered by fencing the explicit reread's **clear** alone with a fourth capture, by `ownedSummaryOf` at both `DocumentSummary` ingresses (the class the review did not name, with four readers, one inside the observation guard), and by routing the transitions guard's two lower `stale` writes through the fenced writer, deleting the positional justification that host callbacks invalidate. The sixth separated four numbers the record had written as one. **The fix changed four source files, so §7.1 commissions a round.** Notes `docs/decisions/2d-5-4-B-notes.md`; review `docs/reviews/phase-2d-5-4-B.md` |
| **2d-5-3**, **2d-5-3-A** and **2d-5-3-B** | The drain lifecycle coordinator (`src/lib/browser/reconciliationCoordinator.ts`, `start()`/`dispose()` on `BrowserState`, the single-flight pump, all four triggers, the `{ epoch, watermark, lastDiscarded }` cursor and the registration/disposal race), then two review rounds over it. **Components: none** | 🔶 **each is `SUPERSEDED` by the next link and none is complete.** 2d-5-3's review returned `do-not-ship` — the first of the 2d-5 chain — with **2 blockers, both concurrency defects no gate could catch** and both re-derived by the orchestrator: a request stranded in the single-flight release window, and an epoch adopted from a drain taken **before** the open reached `ready`, which poisoned the cursor and silently killed reconciliation for the session. 2d-5-3-A (`ship-with-fixes`, 0 blockers) **re-derived both and they hold**, and found four more — two source comments claiming what the code does not give. 2d-5-3-B (`ship-with-fixes`, 0 blockers) found that 2d-5-3-A had replaced one unstated ordering with another. Each fix was comment-only and each changed source, so each commissioned the next. **Rows archived at 2d-5-3-C** to [`docs/progress-archive/status-table.md`](docs/progress-archive/status-table.md) under *"The three superseded rows of the 2d-5-3 chain"*; the notes are `docs/decisions/2d-5-3{,-A,-B}-notes.md` |
| _**2d-5-3-C**, **2d-5-3-D**, **2d-5-3-E** and **2d-5-3-F** — four rounds, each `SUPERSEDED` by the next_ | Four consecutive §7.1 rounds over the same comment block. **Components: none** | 🔶 **each `SUPERSEDED`, none complete**; all four `ship-with-fixes`, **0 blockers**, every gate green at `1320 / 441 / 2307 / 188` throughout. Between them they established the tail's recurring shapes: a justification naming an ordering that does not exhaust the cases (C), **a correction that shipped stale in its own commit** (C), a coverage citation naming a case that drives neither the state nor any Rust (D), a false *absence* written to replace a false *coverage* claim (E), and **the first round whose findings were not all in its predecessor's fix**, whose *0 Medium* was read as convergence and was not (F). **Rows archived 2026-09-05 at 2d-5-3-J** to [`status-table.md`](docs/progress-archive/status-table.md) under *"The four superseded rows of the 2d-5-3 chain, C through F"*, with the later rounds' corrections travelling inline; the notes are `docs/decisions/2d-5-3-{C,D,E,F}-notes.md` and the reviews `docs/reviews/phase-2d-5-3-{C,D,E,F}.md` |
| _**2d-5-3-G** and **2d-5-3-H** — two rounds, each `SUPERSEDED` by the next_ | Two consecutive §7.1 rounds over the same comment block. **Components: none** | 🔶 **each `SUPERSEDED`, neither complete**; both `ship-with-fixes`, **0 blockers**, every gate green at `1320 / 441 / 2307 / 188` throughout. Between them they established two of the tail's recurring shapes: **a comment block asserting a proposition and its negation** ten lines apart, which had sat inside the edited block for two rounds past two reviewers and all four gates (G), and **a claim true only at an instant written as true now**, where the clause a fix deleted was the only one carrying the time index — so **a removal has to check what else the removed clause was carrying** (H). **Rows archived 2026-09-05 at 2d-5-3-K** to [`status-table.md`](docs/progress-archive/status-table.md) under *"The two superseded rows of the 2d-5-3 chain, G and H"*, with the later rounds' corrections travelling inline; the notes are `docs/decisions/2d-5-3-{G,H}-notes.md` and the reviews `docs/reviews/phase-2d-5-3-{G,H}.md` |
| _**2d-5-3-I** — one round, `SUPERSEDED` by the next_ | A §7.1 round over the same comment block. **Components: none** | 🔶 **`SUPERSEDED`, not complete**; `ship-with-fixes`, **0 blockers**, 3 SHOULD-FIX, **the first round of this tail whose entire finding list was in source**. Its lasting shape: **repeating a proposition about a different case is not asserting the same claim**, and a deictic can resolve to the wrong paragraph four lines under the sentence declaring the comment names sites by opening words. **Row archived 2026-09-05 at 2d-5-3-K** to [`status-table.md`](docs/progress-archive/status-table.md) under *"The superseded row of 2d-5-3-I"*; the notes are `docs/decisions/2d-5-3-I-notes.md` and the review `docs/reviews/phase-2d-5-3-I.md` |
| _**2d-5-3-J**, **2d-5-3-K** and **2d-5-3-L** — three rounds, each `SUPERSEDED` by the next_ | Three consecutive §7.1 rounds over the same comment block. **Components: none** | 🔶 **each `SUPERSEDED`, none complete**; all three `ship-with-fixes`, **0 blockers**, every gate green at `1320 / 441 / 2307 / 188`. **Rows archived 2026-09-20 at 2d-5-4-B** to [`status-table.md`](docs/progress-archive/status-table.md) under *"The superseded rows of 2d-5-3-J, -K and -L"*; the notes are `docs/decisions/2d-5-3-{J,K,L}-notes.md` and the reviews `docs/reviews/phase-2d-5-3-{J,K,L}.md`. L's lasting shape: a claim called *pinned by the two derivations under it* attributed **driving** to a test its own next sentence says issues no drain at all — and L is the round whose inherited-tree Rust reading was lost twice to a stale build cache, which is why a `cargo clean` precedes a disputed figure here |
| _**2d-5-3-M** — one round, `SUPERSEDED` by the next_ | A §7.1 round over the same comment block. **Components: none** | 🔶 **`SUPERSEDED`, not complete**; `ship-with-fixes`, **0 blockers**, 2 SHOULD-FIX, every gate green at `1320 / 441 / 2307 / 188` on two full runs. Its lasting shape: **an indefinite replacement for a definite claim reads as a claim about the mechanism**, and as such was false — `open()`'s last generation check is inside the per-document loop, with no check and no await before `workspaceReady()`, so a host whose injected `report` re-enters supersedes the running open and that open still calls it. **Row archived 2026-09-20 at 2d-5-4-B** to [`status-table.md`](docs/progress-archive/status-table.md) under *"The superseded row of 2d-5-3-M"*; the notes are `docs/decisions/2d-5-3-M-notes.md` and the review `docs/reviews/phase-2d-5-3-M.md` |
| **2d-5-3-N** | The round `CLAUDE.md` §7.1 commissioned for 2d-5-3-M's fix — scoped to the one rewritten clause in `reconciliationCoordinator.ts` (799-801), to `2d-5-3-M-notes.md` in full and to its three corrections in the L notes. **Components: none** | ✅ **complete, and the round that CLOSES the 2d-5-3 tail** — the first phase of this chain that is not `SUPERSEDED`. Risk class **high**; worker model **none** (review by **Codex**, `autoclaude-review.sh` exiting 0 so no agent was spawned; fix by the orchestrator). Every gate green on **two** full runs, inherited tree and post-fix, at `1320 / 441 / 2307 / 188`. **Verdict `ship-with-fixes`, 0 blockers**, **2 SHOULD-FIX, both Low and both in the record**, both re-derived before being fixed and both holding. Finding 1: M's *"both numbers are dropped rather than renumbered"* is disproved by the replacement quoted in the same sentence — the **range** was dropped and the **count** renumbered eleven → **ten**; M's suite figures themselves are right and were re-counted (7535, 7779, ten `it(` blocks at the listed lines), so **what was false is only the description of the fix**. Finding 2: *"Twelve of the thirteen rounds … the one exception is still 2d-5-3-F"* is false — `2d-5-3-F-notes.md`'s own header says *"**one is**"* of its three findings, and its §2 names it, E having carried a stale count into its §8 item 3 while **E's own fix added the sixth paragraph** that falsified it; **the tally is dropped rather than renumbered**, because renumbering would assert a thirteen-round audit nobody has performed. **The source clause holds and was re-derived**: the cited test supersedes exactly one open, `open()`'s await at 2603 is followed at 2604 by exactly one generation check with nothing between, and the return there precedes `workspaceReady()` at 2687. **The fix changed no source file** — `PROGRESS.md` and `docs/` only, every path on §7's closed list — so §7.1 commissions no round and §7.2 closes the step. Notes `docs/decisions/2d-5-3-N-notes.md`; review `docs/reviews/phase-2d-5-3-N.md` |
| **2d-6 … 2d-8** | The remaining three steps of the 2d consult's eight | ⬜️ not started |
| **2d** | External change reconciliation — plan §6.5 | 🔶 in progress |
| **3–5** | Validation, packaging, hardening | ⬜️ not started |
| **M — checkpoint split** | This file cut from 21,803 lines to the live head; the rest archived verbatim under `docs/progress-archive/` | ✅ complete (2026-08-29) — preflight maintenance, unreviewed by rule |
| **M2 — tail termination** | The review loop given a stopping rule the files can evaluate: `CLAUDE.md` §7 | ✅ complete (2026-08-29) — two review rounds, both `not-ready`, all findings fixed |

---

## Standing rules

These bind every future phase. The reasoning behind each is in
[`docs/progress-archive/decisions.md`](docs/progress-archive/decisions.md) (D1 … D4).
[`CLAUDE.md`](CLAUDE.md) states the day-to-day rules at length and is not repeated here.

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
- A green test suite is not a screen: a claim about a window needs a reading of a window, re-taken
  after any change to a component.
- A decision record that claims a guarantee the code does not give is this project's worst defect
  class. Where the type system cannot force something, say so in the same sentence that says what it
  does force.
- **A review tail ends by rule, not by an owner ruling** (`CLAUDE.md` §7 is the full statement).
  **One thing commissions a round — a fix round that changed at least one source file — and a step
  closes as soon as no round is commissioned.** There is no second, separately counted clause: a
  0-High/0-Medium verdict is the common case of that one rule, a **Low** whose fix changes source is
  owed a round, a High whose fix is prose only is not, and no item in *"where it is thin"* commissions
  anything — but an **actionable** item naming a correctness defect in source is a **blocker**: it is
  fixed, or the step does not close and is marked `BLOCKED`, never left for a later phase to maybe
  adopt (**recorded only** is the mark for a residual risk or a coverage bound; unmarked counts as
  recorded only). **"The record" is the closed list — `PROGRESS.md`, `CLAUDE.md`,
  `IMPLEMENTATION_PLAN.md`, any `README*`, everything under `docs/` — and every other file is source,
  even when it looks like documentation**, so a manifest, a lockfile, `vite.config.ts` or a `scripts/`
  file is source and its fix is reviewed. **The unbounded predecessor of this rule** — *a fix is a
  change*, with no source bound — ran **14 rounds on 2d-3-C** and **9 on 2d-4a-C step 2**, both
  stopped by a human; rounds 4-9 of the second changed no source file, so this bound would have ended
  it after round 4. Those two tails are the evidence **for** the bound, never a precedent for closing
  by owner ruling (`docs/decisions/review-tail-termination.md`). What the bound does **not** do is end
  a tail whose every fix keeps introducing a real source defect — that tail is finding real defects,
  and it is `BLOCKED` work rather than a rule to weaken.
  **Under `/goahead-opus` or `/goahead-fable` the
  workflow's cap of two review invocations and 45 minutes per phase is tighter and binds first, and a
  source fix that cap leaves unreviewed becomes a new corrective phase carrying that review, with the
  original phase recorded as superseded by it, never as complete.**
- **That rule has now run end to end, and it closed a tail.** Phase 2d-4a's thirteen-round tail ended
  at round 13 on 2026-08-30 because the fix answering it changed **no source file** — three correction
  blocks under `docs/`. **This is the first tail this project has ended by rule rather than by an owner
  ruling**, and it ended exactly where §7.2 says a tail ends: at the first fix that stops touching
  source. Two things it does **not** license. Closure is a fact about the *fix round's diff*, never
  about the round's thoroughness — so it discharges no coverage bound the tail was carrying. And the
  round that closes is still a real round: round 13's two findings were **re-derived by the
  orchestrator before being accepted**, and the one figure it could not verify was chased down rather
  than carried, which is what makes the closure trustworthy rather than merely valid.
- Sweep for the shape a finding names, never for the words it used; every narrower instance this
  project has shipped was missed by searching the previous wording. **`docs/decisions/2d-4a-notes.md`
  §22.1 is the strongest instance on file**: *"measure one span, label another"* recurred **inside the
  correction block written to fix its previous occurrence**, which is why only re-deriving a figure
  catches it and re-reading the sentence never does.

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
| R38 | **Every window reading this project has taken ran on one easy fixture shape, and none of the fifteen corpus fixtures `CLAUDE.md` §4 lists has ever been through the harness.** 3c-2's 71 launches used plain `replace:` scalars, double-quoted triggers, one leading comment, LF, no BOM — no block scalars, no item-owned comments, no blank-line runs, no second sequence, no read-only file, no package. The fifteen fixtures exist *precisely because those shapes behave differently* | Open, and stated as 3c-2 §12's own bound rather than discovered later. It is **not** a defect claim: the byte-exactness of every edit over both corpora is what the Phase 0 gate discharged, at the core, with a property test. What is unevidenced is the **window's** behaviour over those shapes — a reapply refusal drawn against a block scalar, a conflict panel over a file with item-owned comments. The harness dies at 3d, so closing this means rebuilding it; the cheaper mitigation is to add one hard fixture shape to whichever instrument the next reading-bearing phase builds, rather than to reopen 2c-4b for it |
| R39 | **A shared user-facing string is not a shared predicate, and a sweep that assumes otherwise manufactures findings in both directions.** 2c-4b-3c-2's review found `browser.notice.differentMatch` claiming an identity its producer cannot give — and then found the fix round alleging the same defect in `displacedByMove` and `displacedByDuplicate`, where the revision guard on each attributed adoption path *earns* the claim | Open as a standing method rule, not as a defect. Four notices carried one clause; two are false and two are true, and **only reading each notice's own producer separates them**. The cost of getting it wrong is symmetric: a missed instance ships a false sentence, and a manufactured one hands a later step work that does not exist and invites a "fix" that breaks a correct sentence. **`browser.notice.gone` is the untested half** — it is length-based, source-derived and was **never drawn in any of the 110 launches**, so its half of the finding has no screen behind it |
| R37 | **A model rule that reads the live projection agrees with itself only over consistent inputs, and nothing forces a caller to supply them.** `matchMoveView(session, R0Views)` answering `canMove: true` beside `beginMove(session, identityInProjection(R1Views, …))` answering `null` type-checks, and no signature refuses it. The same shape is `beginMove`'s `projected` argument and `confirmDelete`'s, where nothing in TypeScript can say where an argument came from | Accepted and **stated in the same sentence as what the code does force** — in `refusalGiven`, in `beginMove` and in the two module headers — after a review round found the record claiming the two "cannot disagree by construction". What would close the remaining half is a requirement on the caller: **a component must derive the view, the destination options and the submission identity from one read of the current projections, in one synchronous block.** A screen holding a stale copy of `BrowserState.views` gets the stale answer from every one of them, consistently and wrongly |

**Closed risks** — the full index of every risk this project has closed, with the phase and decision
that closed each, is in
[`docs/progress-archive/decisions.md`](docs/progress-archive/decisions.md) under *"The closed-risk
index"*. **It was archived at 2d-5-2a because it is pure index**: no row is work, and no later phase owes
any of them anything.

---
## Next action

### Phase 2d-5-4-B — the round §7.1 commissioned for 2d-5-4-A's fix — is **taken and answered** and is **`SUPERSEDED BY 2d-5-4-C`**: Codex at `ship-with-fixes` with **2 blockers and 4 SHOULD-FIX**, all six re-derived and all six holding, and three more found that the review missed.
### The next action is **Phase 2d-5-4-C**, the review round `CLAUDE.md` §7.1 commissions because that fix changed four source files.

> **⚠️ ARCHIVE BEFORE YOU WRITE ANYTHING.** A record of this chain has cost between 16 and 132 lines,
> and the **byte** bound is the one that binds. Move the closing phase's record and Next-action prose
> to [`next-action-history.md`](docs/progress-archive/next-action-history.md), and its verification
> narrative and the ladder narrative to
> [`phase-2d.md`](docs/progress-archive/phase-2d.md), **before writing a word**. **2d-5-4-A took two
> — 128 lines of record and Next-action prose, and 33 of verification narrative — and came back 36
> lines and 1,522 bytes under what it inherited**, which is what a review round's record can do and an
> implementation phase's cannot: **2d-5-4 took four** (56 + 30 + 32 + 13 lines) and still grew.
> 2d-5-3-N took two (38 + 25) plus the header paragraphs; 2d-5-3-M took three and compressed the
> ladder to its live rung; 2d-5-3-J and -K each took four and then a superseded status row. **A row
> the chain has itself superseded *may* move; the chain's head may not.** Take narrative first,
> measure, then take rows — and measure **again** after the git-state row, which alone costs some
> 2,800 bytes.
> **The reserve is spent: all four superseded rows — J's, K's, L's and M's — were taken at 2d-5-4-B**,
> two before the record was written and two more when the git-state row put the file 461 bytes over the
> hard bound. They are in [`status-table.md`](docs/progress-archive/status-table.md) under two new
> headings. **What is left in the status table of the 2d-5-3 chain is N's row alone**, and N is not
> superseded — it is the round that closed the tail — so under this box's own condition **it may not
> move**. A round after 2d-5-4-B that needs bytes has no row to take and must archive narrative, or
> compress a row in place rather than moving it.
> The figures are in the header, and **re-derive them on this file, never quote them.**

#### ⚠️ READ FIRST — the working tree is deliberately NOT clean, and that is not a killed phase

`git status --short --untracked-files=all` shows **four uncommitted harness paths**, and they are the
product of the phase that just closed rather than the wreckage of one that did not:

```
 M src-tauri/src/main.rs      two hook lines — `mod probe;` and `probe::register_with_probe(…)`
 M src/main.ts                two hook lines — the `startProbe` import and its call
?? src-tauri/src/probe.rs     the four probe IPC commands and the two external writers
?? src/probe.ts               the Svelte-driving plan driver
```

**Do not commit them, do not revert them, and do not treat them as unaccounted-for work.** The
instrument is never committed — `2c-5-5a-instrument-rebuild.md` §1 and every instrument record since
say so — and a later step deletes it. `git diff --stat` over the two hook files is **`5 insertions(+),
1 deletion(-)`** and must stay that way; it agrees exactly with 2c-5-5a §2.1's four lines, and it was
re-checked at every round of this chain — most recently **on 2d-5-3-L's inherited tree and again after
its fix**. **Every commit of this chain stages `PROGRESS.md` and its `docs/` files by path** and leaves
these four alone; every round from 2d-5-3 to 2d-5-3-L also stages `src/lib/browser/` by path, because
each had source of its own to commit.
**Two staging rules, and the history that argued them is archived.** A commit of this chain stages
`src-tauri/` files **by name, never by directory**, because `src-tauri/src/` would sweep the
instrument's `probe.rs` and `main.rs` in with it — 2d-5-3-C is the only round that ever staged one, by
name. And **reading Rust is not changing it**: every round from 2d-5-3-D onward changed no Rust source
at all while several established findings by reading some, so none of those commits stages any path
under `src-tauri/` whatever. **2d-5-3-K read more than any of them** — that doc comment again, the `open()` **body** under it,
and every `session.drain_external_changes(...)` call in that file's own tests — and 2d-5-3-J had already
**quoted two of the doc comment's sentences into the TypeScript comment**, so a Rust file this chain does
not commit is load-bearing for a claim in a file it does. **2d-5-3-L's reviewer read `commands.rs` 625–718 to re-derive them, and none of the three rounds staged a byte of it.** The round-by-round account is in
[`phase-2d.md`](docs/progress-archive/phase-2d.md) under *"The 2d-5-3 chain's per-round staging
history"*.

#### Phase 2d-5-4-B — the round `CLAUDE.md` §7.1 commissioned for 2d-5-4-A's fix

**Taken and answered, and `SUPERSEDED BY 2d-5-4-C` rather than complete**, because its own fix changed
source. Risk class **high**; worker model **opus** — **no implementation worker**: one **read-only
re-derivation** worker, then one fix worker, the shape this chain has settled on. Record
[`docs/decisions/2d-5-4-B-notes.md`](docs/decisions/2d-5-4-B-notes.md); review
[`docs/reviews/phase-2d-5-4-B.md`](docs/reviews/phase-2d-5-4-B.md); brief
[`docs/reviews/phase-2d-5-4-B.brief.md`](docs/reviews/phase-2d-5-4-B.brief.md); the re-derivation
[`docs/reviews/phase-2d-5-4-B.rederivation.md`](docs/reviews/phase-2d-5-4-B.rederivation.md).

**The review was Codex**, through `autoclaude-review.sh`, which **exited 0** so no agent was spawned —
**four consecutive Codex rounds**. **Verdict `ship-with-fixes`, 2 blockers and 4 SHOULD-FIX.** **The
report's finding bodies arrive truncated again**, 180 characters each, so **not one was accepted on the
report's strength**: all six were re-derived from the code by a read-only worker, and the orchestrator
**spot-checked the decisive lines of five of them**. **All six held.** Five are defects in source; the
sixth is arithmetic in the record. The re-derivation also found **three things the review missed**, each
a generalization of a finding the review had already made.

**Both blockers are the defect the previous round closed, one level down or one step later.** `open()`
normalizes **after** its last generation check, and the final document has no next iteration:
`ownedProjectionOf`'s field reads and the injected `report` both run between that check and
`views = projected; status = 'ready'`, so an accessor that synchronously re-opened the workspace watched
this function install the **superseded** configuration's projections and call `workspaceReady()` over
them — the coordinator's drain gate opened for a lifecycle nothing on screen belongs to. Fixed by a
**second generation check after the loop**, the one the per-iteration check cannot make. And
`ownedMatchOf` wrote `id: match.id`, so the **identity object stayed the command's**: `positionOf` reads
`match.id.node` at three adoption sites, between the selection-follow guard and the `replaceSelection`
that guard justifies. Fixed by `ownedMatchIdOf`, and by `ownedIdentityOf` for the `target` and `moved`
a save answer carries — copied at each adoption's first statement, before its only `await`.

**Three SHOULD-FIX are one question asked too early, or not at all: does this writer still own what it
is writing?** The explicit reread cleared a status **a newer `Unreadable` had set** —
`BrowserState.rereadDocument` passes `ALWAYS_PERMITTED`, so nothing on that path asked, and the
observation is never redelivered — fixed by capturing `statusWriteOf` beside the guard's other three and
fencing **the clear alone**, the install deliberately left unfenced so the window shows older content
under a mark that correctly says the file could not be read. The failure arm's last read before its
write was `documents.some((held) => held.id === document)`, caller code **after** all three of its
fences — fixed **at ingress** by `ownedSummaryOf`, because `DocumentSummary` was a whole unnormalized
ingress class the review did not name, with four readers including one inside the observation guard.
And the transitions guard's two lower arms were defended by a **positional** argument — *reaching this
line means the ownership question two arms up already answered yes* — which host callbacks invalidate:
`tellTheSurfaceAbout` runs `openWriteSurfaces()` and `creatorEligibility()` in between. Both writes now
take the fenced writer as a parameter, and the two positional justifications are deleted, including the
one claiming no test could tell the fence from its absence — two of this round's cases do.

**The sixth is the record's arithmetic, and its fix separated four numbers that had been one**: nine
tests added net, ten `it(` blocks added and one deleted, **eight** discriminating cases in a seven-row
table, and two discarded candidates. Beside it, two correction blocks: a *recorded only* mark in
`2d-5-4-notes.md` that sat on a **correctness defect in source** and under §7.3 should have been a
blocker, and `2d-5-4-A-notes.md` §6's claim that a fence on the registry arm *"cannot discriminate"*,
which finding 5 disproves.

**Two things the round did not do, stated rather than glossed.** It added **no user-facing string in
any language** and touched **no `.svelte` file**, so no window reading is owed. And it left
`npm run build` at **189** modules: all three new normalizers live inside `workspace.svelte.ts`, so the
ladder's *one module per new source module* rule predicts no movement and none happened.

**One defect in this round's own record, found by the orchestrator before the commit and fixed in
place.** `2d-5-4-B-notes.md` had a section for every finding **but finding 3**, whose fix and whose
pinning case were both in the tree. It is now `§3a`, numbered that way because renumbering would
falsify the twenty §N cross-references the file already carries.

#### The next action is **Phase 2d-5-4-C — the round §7.1 commissions for 2d-5-4-B's fix**

**Scoped to that fix's diff**: `src/lib/browser/workspace.svelte.ts`,
`src/lib/browser/observationTransitions.ts` and their two suites, plus
`docs/decisions/2d-5-4-B-notes.md` in full and the correction blocks this round wrote into
`2d-5-4-notes.md` and `2d-5-4-A-notes.md`. **This is a review round, not implementation**: it takes no
implementation worker, and its own fix decides whether another round follows, by §7.1 and nothing else.

**Five things to point it at first**, each because the fix that answered a finding is where the next
finding has lived in every tail this project has run:

1. **The second generation check in `open()`.** It catches the last document's accessors — does it catch
   everything between the loop and `workspaceReady()`? Four statements and a call run after it, and
   `installView` is not the only writer on that path.
2. **`ownedMatchIdOf`'s three fields against `MatchId`, and `ownedSummaryOf`'s against
   `DocumentSummary`.** Both claim the compile-error property `ownedProjectionOf` claims, and both carry
   the same optional-member caveat. Is a **fourth** ingress class still unnormalized — a `SaveResult`, a
   `ConflictModel.source`, a restore-catalogue row? The re-derivation swept `DocumentView` and found
   nine ingresses and no tenth; nobody has swept the others.
3. **The clear's fence, and the install left unfenced.** The comment argues the window is never worse
   off. Is that true when the newer observation is a `Removed` rather than an `Unreadable`, and when
   `repairAfter(next)` runs immediately afterwards over a projection the newer truth contradicts?
4. **`markStaleWhileOurs` passed as a parameter into `tellTheSurfaceAbout`.** It is now reached from two
   functions and four arms. Does every arm that writes still hold the ownership answer it needs, and does
   the hoisted closure capture the same `route.sequence` at both call sites?
5. **The three correction blocks this round wrote**, plus `§3a`. One of them **re-marks an item from
   *recorded only* to a blocker**; check that what replaced the struck text is true, and that no narrower
   wording of the struck claim survives anywhere — 2c-4a-3a's round 2 found exactly that, and this
   round's worker reports having swept for it in two further places.

**Nothing is `BLOCKED`.** `docs/decisions/2d-5-4-B-notes.md` §11 carries this round's marked items;
one is **actionable** and it names a check to run rather than a correctness defect in a source file, so
under §7.3 nothing holds the step open.
#### The candidate corrective phase this chain produced, still not discharged

**Four cross-file `file:line` citations in comments under `src/` are stale right now.** `src/` holds 10
fully-qualified citations and 16 bare `:NNN` continuations; four of the ten are wrong —
`browser/reapply.ts:612` and `:613`, `browser/writeSurfaceRegistry.ts:231` and
`browser/restore.test.ts:2504`. **Every one that was chased was correct when written**, so the class is
drift, and `writeSurfaceRegistry.ts`'s instance was caused by 2d-5-2b's own additions to
`DetailPane.svelte` and survived all five rounds of the chain that caused it. The measurement is
`2d-5-2b-notes.md` §17.3 and §17.4; the full argument is archived in
[`next-action-history.md`](docs/progress-archive/next-action-history.md) under *"archived 2026-09-05 at
Phase 2d-5-2c-1"*. **The cheap durable guard, if a phase wants one, is a checker that resolves
`file:line` references in comments** — nothing in this repository pins one of the 26 today.

#### What `writeSurfaceRegistry.ts` is, after five phases — **archived**

Its 27 lines are in [`next-action-history.md`](docs/progress-archive/next-action-history.md) under
*"archived 2026-09-05 at Phase 2d-5-3-A"*, **nothing in them superseded**; 2d-5-4 and 2d-5-5 want
them. The one sentence that is a check rather than a description: **the generation moves at exactly
three places**, and the `rg -n 'writeSurfaces\.' src/lib/browser/workspace.svelte.ts` sweep does
**not** show the lease's two mutations, so it is weaker than the item it serves.

#### The rest of the split, so a step is not invented

**2d-5-3** the drain lifecycle coordinator; **2d-5-4** the observation state transitions; **2d-5-5**
external conflicts and save arbitration; **2d-5-6** the file-wide route-guard closure; **2d-5-7**
production activation, the capability widening and the baseline re-measure (components: **yes**,
`AppShell.svelte` only).

The three documents that bind every step, in reading order:
[`docs/reviews/phase-2d-5-design.md`](docs/reviews/phase-2d-5-design.md) (**the consult; it binds**),
[`docs/decisions/2d-5-split-notes.md`](docs/decisions/2d-5-split-notes.md) (the record — read its §5
corrections before treating `phase-2d-design.md` step 5 as the spec) and
[`docs/decisions/2d-5-design-brief.md`](docs/decisions/2d-5-design-brief.md) (the brief).

#### The one item 2d-5 still inherits as work

**The drain guard's escaping route, discharged at 2d-5-6 and not before.**
`src/lib/browser/workspace.svelte.ts` imports its command wrappers at module level, so a call made
through one of those bindings rather than through an injected parameter increments the `drains`
counter in nothing. The route is caught in **six** named cases — one `expect(invoked)` assertion in
`DetailPane.test.ts` and five in `RestorePane.test.ts`, each in a distinct `it` block and **in neither
`afterEach`** — while `workspace.test.ts`, whose subject module holds the route, has no
`@tauri-apps/api/core` mock at all. **The closure is owed to all three files.** This is
`2d-4b-notes.md` §14.8 item 1 (re-derived by `2d-5-split-notes.md` §7), which 2d-4b's closure
explicitly did not discharge.

#### Two properties a later step could make live

1. **`targetingSurfaceFor`'s first-wins guard (`restore.ts:623`) is behaviourally inert today**: only
   the `matchCreator` arm of `OpenWriteSurface` carries a `WriteSurfaceTarget`, so a destination-less
   surface is always a `matchCreator` and the variable can only hold that one string. The comment
   there claims only what is true and was deliberately **not** widened. Give a second kind a
   `WriteSurfaceTarget` and the guard stops being inert on its own. `2d-5-1-C-notes.md` §3 is the record.
2. **`invalidateEverySurface`'s body is executed by a test and its *effect* is still unobservable**
   while `busy` keeps the seven surfaces mutually exclusive. **2d-5-1-B's measurement is not
   superseded** — deleting a line from that function still breaks no test in this repository. It stays
   a coverage bound rather than a correctness defect, so §7.3 holds no step open for it.
   `2d-5-2b-notes.md` §9.1 and §11 item 6 are the record.

#### Residues that are recorded, not work — **archived at 2d-5-3-C**

**None is a correctness defect in source**, so none holds a step open (§7.3). All four are in
[`docs/progress-archive/next-action-history.md`](docs/progress-archive/next-action-history.md) under
*"The recorded residues, archived 2026-09-05 at Phase 2d-5-3-C"*, unedited. The one a later step is
most likely to trip over, kept here because it is a **method rule** rather than a residue:
**`scripts/lint/ipc-detail.test.ts` generates its cases from `scannableFiles()`**, so its count moves
when a file is merely *added* under the scanned roots — **re-derive a test count per file, on a
pristine tree, never from the total.**

---
## Verification baseline

### The rung moved by six, and only by this round's own tests

**With the instrument in the working tree the four commands answer `1320 / 443 / 2395 / 189`** —
`cargo test --workspace` / `npm run check` files / `npm test` / `npm run build` modules. **Measured in
full by the orchestrator at 2d-5-4-B**, on the post-fix tree, each command run on its own:

| Gate | Was at 2d-5-4-A | Now | Why it moved, or did not |
|---|---|---|---|
| `cargo test --workspace` | 1320 | **1320** | no Rust changed — `git diff --numstat -- crates/ src-tauri/` names only the instrument's `main.rs` hook |
| `npm run check` files | 443 | **443** | no file added or removed; the fix is inside four existing files |
| `npm test` | 2389 | **2395** | +6, the six cases this round's five source fixes are pinned by |
| `npm run build` modules | 189 | **189** | no new module: `ownedMatchIdOf`, `ownedIdentityOf` and `ownedSummaryOf` all live inside `workspace.svelte.ts` |

`cargo test --workspace -- --test-threads=1` was read from a file rather than through a pipe, summed
over **26** `test result` lines *and* checked by the complementary question — no line lacking
`0 failed` — and it completed on the **first attempt**, so 2d-5-3-L's stale-`target/` host finding has
now not recurred for five consecutive phases. `cargo clippy --workspace --all-targets -- -D warnings`
(exit 0), `cargo fmt --check` (exit 0) and `cargo tree -p espansoconfig-core | rg tauri` (finds
nothing) are clean. **Both bundle oracles were read and both lines are reported**: server-only markers
**absent**, client-only markers **present (2)**. **The instrument's pin was re-checked** and holds at
`5 insertions(+), 1 deletion(-)`.

**No gate caught any of the six findings, and no gate could have.** Five were re-entrancy or ordering
defects reachable only through an injected accessor, an injected host method or an interleaving no
test had combined, and the sixth was arithmetic in a record. **Six cases now pin the five source
fixes, and each was confirmed to fail against the pre-fix code** — the fix worker reverted each change
in the tree, ran the one suite, recorded the failure message and restored it; the messages are in
`docs/decisions/2d-5-4-B-notes.md` §10. **No candidate was run and found to pass both ways this
round**, and that is a difference from 2d-5-4-A rather than an improvement on it: three shapes for
finding 4 were rejected by argument before being written, which is a weaker check than running one,
and the notes record the distinction rather than blurring it.
### The ladder's live rung

**`1320 / 443 / 2395 / 189`**, at 2d-5-4-B. The two rungs below it are `1320 / 443 / 2389 / 189` at 2d-5-4-A and `1320 / 443 / 2380 / 189` at 2d-5-4. The rung below it is `1320 / 441 / 2307 / 188`, held from
2d-5-3-A to 2d-5-3-N. **The instrument landed at 2d-5-2c-1**, whose rung was `1320 / 439 / 2255 /
187`, so every rung at or after it is a *with-instrument* figure and the two groups may not be
compared without subtracting the instrument's known contribution. The full per-rung list is in
[`phase-2d.md`](docs/progress-archive/phase-2d.md).
### The superseded baseline blocks of 2d-5-2b-D … 2d-5-3

Their figures are every rung of the ladder below and their decompositions are in each phase's notes
(2d-5-3's in `2d-5-3-notes.md` §6 and §8.6), so nothing is lost by not restating them: each was **true
of the tree that committed it**. **The block below is the one exception and is kept in full**, because
it carries the *production* measurement 2d-5-7 will compare against.

### The baseline as it stood before the instrument landed

**`1320 / 438 / 2254 / 186`** — `cargo test --workspace` / `npm run check` files / `npm test` /
`npm run build` modules. **Measured in full by the orchestrator alone on 2026-09-05, across Phases
2d-5-2b-D and 2d-5-2b-E**, each command run on its own. The three frontend gates were run **four
times** — on the tree as inherited, after 2d-5-2b-D's fixes, and again on 2d-5-2b-E's final tree —
and every run returned the same three figures. **2d-5-2b-E changed no source file at all** (its commit
is record files only), so its run confirms rather than re-establishes the baseline. `npm run check` → **438 files, 0 errors, 0
warnings** (both runs); `npm test` → **59 files, 2254 passed**, exit 0 (both runs); `npm run build` →
**186 modules** (both runs); `cargo test --workspace -- --test-threads=1` → **1320**, summed over
**26** binaries *and* checked by the complementary question — **no `test result` line lacking
`0 failed`** — because a sum can be right while a binary is silent. Clippy (exit 0),
`cargo fmt --check` and `cargo tree -p espansoconfig-core | rg tauri` (finds nothing) were all clean.
**Both bundle oracles were read after the fix and both lines are reported**, the second because it
proves the search can match at all: server-only markers **absent**, client-only markers
**present (2)**.
**The Rust half was proven untouched** — `git diff --numstat` over the phase's fix names only
`src/lib/components/`, so no path under `crates/` or `src-tauri/` — which is why the Rust figure was
measured once, on the inherited tree, and the fix could not move it.

**No count moved this phase, and that is the expected result.** The fix is **comment-only** — that
was verified mechanically rather than by eye, with `git diff -U0` filtered to changed lines that are
not comment lines, which returned nothing — so no file entered or left the program, no new reachable
module, no new component and no new case. **It is also line-count-neutral**: `git diff --numstat` is
`1 1` and `3 3`, which is this phase's structural guard against the self-invalidating citation its
review found (§16.2 of the notes). The previous baseline was the same `1320 / 438 / 2254 / 186`,
measured at Phase 2d-5-2b-D, at 2d-5-2b-C, at 2d-5-2b-B and at 2d-5-2b-A on 2026-09-05.

**2d-5-2b-E moved nothing and could not have.** Its commit contains `PROGRESS.md`,
`docs/decisions/2d-5-2b-notes.md`, `docs/progress-archive/next-action-history.md` and
`docs/reviews/phase-2d-5-2b-E.md` — every one on §7's closed list, and none of them is read by
`svelte-check`, by `vitest` or by the Vite build. The Rust figure was last measured on the same source
tree and no path under `crates/` or `src-tauri/` has changed since.

### The `cargo test --workspace` gate is flaky on this host **alone**, and that is new

**This is the sharpest thing this phase measured, and it is a host finding rather than a source
one.** The recorded scar said `cargo test --workspace` is unsafe to run *concurrently with itself*.
**That is too narrow.** At 2d-5-2b-A a **solo** run — nothing else on the machine — failed **8**
`watch_check` tests, every one at `wait_until_ready` with *"timed out waiting for the watcher's
baseline scan"* against a `PATIENCE` of **120 seconds** (`src-tauri/src/watch_check.rs:72`). An
earlier run in the same session, concurrent with the three frontend gates, failed **9**. The two
failure sets differ, and `a_real_removal_under_match_reaches_the_sink` passed while its `config`
twin failed — **partial and unstable, not uniform**, which is what rules out a source defect.

**The cure is `--test-threads=1`, and it was measured rather than guessed.**
`cargo test -p espansoconfig --bin espansoconfig watch_check -- --test-threads=1` → **20 passed, 0
failed** in 84.65s. Then `cargo test --workspace -- --test-threads=1` → **1320 passed, no `test
result` line lacking `0 failed`**, exit 0 — which is exactly the recorded baseline. The cause is
parallel **real filesystem watchers** inside one binary, not two cargo processes.

**Three consequences a later phase must not have to rediscover.**

1. **`cargo test --workspace` on its own is no longer sufficient evidence on this host.** A failing
   `watch_check` set means *re-run it serially before concluding anything* — and **no conclusion
   about source may be drawn from either a concurrent run or a parallel one that fails only
   `watch_check`**.
2. **`--test-threads=1` is the authoritative form of the gate here**, and it is what produced the
   1320 above. It costs wall clock and buys a figure that does not move under scheduling luck.
3. **Never read a cargo exit status through a pipe.** At 2d-5-2b-A the first run reported
   `exited with code 0` while 9 tests failed, because the command ended in `| tail -60` and the
   pipeline's status is `tail`'s. Redirect to a file and grep it; the exit code is then cargo's.
   That cost one wrong reading before it was caught. **2d-5-2b-B followed all three consequences** —
   serial form, redirected to a file, and the complementary `0 failed` question asked of every one of
   the 26 `test result` lines — and the gate was clean on both of its runs.

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
| [`docs/decisions/2d-4-split-notes.md`](docs/decisions/2d-4-split-notes.md) | **2d-4b's whole spec is §2.** §3 says why the EN/ES JSON landed in 4a and the accessors in 4b; §4 says what neither step does. Read this before the design consult, not after |
| [`docs/reviews/phase-2d-5-design.md`](docs/reviews/phase-2d-5-design.md) · [`docs/decisions/2d-5-split-notes.md`](docs/decisions/2d-5-split-notes.md) · [`docs/decisions/2d-5-design-brief.md`](docs/decisions/2d-5-design-brief.md) | **2d-5's binding rulings, its record and the brief that produced them.** Read the consult first, then the record's §5 corrections — the consult overrides `phase-2d-design.md` step 5 in two places. §6 carries seven unsettled items, §7 the inherited drain-guard counts |
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
| **2d-5-3 — the drain lifecycle coordinator: `reconciliationCoordinator.ts` and its suite (new), `start()`/`dispose()` on `BrowserState` and the `open()` trigger, and the review's four fixes. Review 1 `do-not-ship` — **2 blockers, 2 Lows, all four fixed in this commit**, both blockers **re-derived by the orchestrator** before the fix was commissioned. The fix round changed **three source files**, so §7.1 commissions a round and this phase is **`SUPERSEDED BY 2d-5-3-A`**, never complete. Stages `PROGRESS.md`, `docs/` and `src/lib/browser/` **by path**; the four harness paths stay uncommitted. Also archives the closed 2d-5-2 chain's five status rows, its Next-action prose and its fifteen git-state rows | **`332a751`** | ✅ pushed to `origin/main` |
| 2d-5-3 — the SHA and push record | `b30b453` | ✅ pushed to `origin/main` |
| **2d-5-3-A — the round §7.1 commissioned for 2d-5-3's fix. Verdict `ship-with-fixes`, **0 blockers**; both of 2d-5-3's fixed concurrency defects **re-derived by the round** and holding. Four further findings, all fixed in this commit: two source **comments** claiming what the code does not give, a test name claiming a case its body did not cover, and a residual stated wider than it was. The `reconciliationCoordinator.ts` half is **comment-only, proven mechanically**; `workspace.svelte.ts` is byte-identical to `HEAD`. The fix changed **two source files**, so §7.1 commissions a round and this phase is **`SUPERSEDED BY 2d-5-3-B`**, never complete. Stages `PROGRESS.md`, `docs/` and `src/lib/browser/` **by path**; the four harness paths stay uncommitted. Also archives 2d-5-3's Next-action prose and the `writeSurfaceRegistry.ts` description — 121 lines** | **`37d2aed`** | ✅ pushed to `origin/main` |
| 2d-5-3-A — the SHA and push record | `1a135fd` | ✅ pushed to `origin/main` |
| **2d-5-3-B — the round §7.1 commissioned for 2d-5-3-A's fix. Verdict `ship-with-fixes`, **0 blockers**; the *independence* half of 2d-5-3-A's rewritten comment **re-derived by the round** and holding. One Medium: that rewrite replaced an unstated *host* call order with an unstated *cross-process* one — the same shape its own finding 1 was raised to remove — and the reviewer's `NOT-VERIFIED` premise was **turned into a measurement by the orchestrator**, tracing `drain_external_changes` and `WorkspaceSession::open`'s swap block to **the same session mutex**, reached in an order neither side chooses. **The sweep found three further instances**, none in 2d-5-3-A's diff, all three fixed, the scope extension argued in the notes §2.1. One Low in two parts: a **self-invalidating citation** whose recipe the fix itself broke, and an able-to-fail claim that stopped one assertion short — the gate assertion at `workspace.test.ts:7624` **measured** here. The diff is **comment-only, proven mechanically**, `42 23`, in **one source file**, so §7.1 commissions a round and this phase is **`SUPERSEDED BY 2d-5-3-C`**, never complete. Stages `PROGRESS.md`, `docs/` and `src/lib/browser/` **by path**; the four harness paths stay uncommitted. Also archives 2d-5-3-A's Next-action prose — 103 lines** | **`337a6f6`** | ✅ pushed to `origin/main` |
| 2d-5-3-B — the SHA and push record | `ef464cb` | ✅ pushed to `origin/main` |
| **2d-5-3-C — the round §7.1 commissioned for 2d-5-3-B's fix. Verdict `ship-with-fixes`, **0 blockers**, 2 Medium and 3 Low, **all five re-derived by the orchestrator before being fixed**. Medium 1: the previous rewrite's two-order enumeration is falsified by a **third reachable state** — `open()` bumps the generation unconditionally while `WorkspaceSession::open` returns from `Workspace::discover(root)?` before taking the lock, so a refused open leaves the **previous** workspace installed and the batch's queue is neither gone nor foreign. The arm now rests on **unattributability**, because resting it on the cursor clear would have contradicted the same comment's first paragraph. **The sweep found a fourth site the review did not name.** Medium 2: **the correction written to close a self-invalidating citation was itself stale in its own commit** (`:979` → `:995` → `:1014`), in **four** places, now anchored on the comment's opening words rather than renumbered. Three Lows: a 112-character line, a precedent attributed to the wrong phase (**`2d-5-2b-D`**), and — out of scope, fixed anyway — `with_workspace_read`'s doc claiming **three** customers when it has **four**, in flat contradiction with the fourth's own doc. **Four `NOT-VERIFIED` items closed by measurement**, including the `:7624` mutation no round of this chain had reproduced. Both diffs are **comment-only, proven mechanically**, `54 33` and `8 3`, across **two source files**, so §7.1 commissions a round and this phase is **`SUPERSEDED BY 2d-5-3-D`**, never complete. Stages `PROGRESS.md`, `docs/`, `src/lib/browser/` and `src-tauri/src/commands.rs` **by path** — the Rust file **by name, never by directory**, so the instrument's `probe.rs` and `main.rs` are not swept in. Also archives 2d-5-3-B's Next-action prose, the 2d-5-3 chain's three superseded status rows and the recorded residues — 115 + 3 + 21 lines** | **`85181ac`** | ✅ pushed to `origin/main` |
| 2d-5-3-C — the SHA and push record | `9bbcbf4` | ✅ pushed to `origin/main` |
| **2d-5-3-D — the round §7.1 commissioned for 2d-5-3-C's fix. Verdict `ship-with-fixes`, **0 blockers**, 3 Medium and 1 Low, **all four re-derived by the orchestrator before being fixed**, and all three Mediums found by the brief's one instruction — *check the comments against the code, not the code against the comments*. Medium 1: the paragraph written to forbid a two-way disjunction **widened its own third state by a case that belongs to the second** — `workspace.svelte.ts` returns on `!opened.ok` before calling `listDocuments()`, so a refused `list_documents` means `open_workspace` **succeeded** and Rust holds the **new** workspace with its queue reset by the swap block. Medium 2: the `awaitingReady()` arm's new reason is **false at that arm** — it is reached only when the generation is unchanged, and the arm's own opening sentence says the two checks are not the same question; the previous wording did not carry it, so **the fix introduced it**. Medium 3: the coverage citation names a case that drives **neither the state nor any Rust** — no workspace was ever installed, `drainSequences` stays `[0]` so no batch reaches the arm, and a scripted vitest drives no Rust; the comment now states that **nothing in this repository drives it**. The Low is a record defect — *"blocked on the session mutex"* contradicts `commands.rs`'s **"Why every command is synchronous"** (no `async fn` exists there), so the order is the **dispatcher's**; **the two source comments naming the mutex claim only an order and were checked and left**. The sweep found the false claim in **two** of seven `list_documents` positions and **refused to "correct" the five carrying the adjacent true one**. The diff is **comment-only, proven mechanically**, `33 11`, in **one source file**, so §7.1 commissions a round and this phase is **`SUPERSEDED BY 2d-5-3-E`**, never complete. Stages `PROGRESS.md`, `docs/` and `src/lib/browser/` **by path**; **no path under `src-tauri/` at all**, because no Rust source changed, and the four harness paths stay uncommitted. Also archives 2d-5-3-C's Next-action prose — 130 lines — and, in a **second** archive taken because the measurement said the head had grown, the closed chains' archive arithmetic — 67 lines — to [`phase-2d.md`](docs/progress-archive/phase-2d.md)** | **`c4a428c`** | ✅ pushed to `origin/main` |
| 2d-5-3-D — the SHA and push record | `a29c544` | ✅ pushed to `origin/main` |
| **2d-5-3-E — the round §7.1 commissioned for 2d-5-3-D's fix. Verdict `ship-with-fixes`, **0 blockers**, 2 Medium and 0 Low, **both re-derived by the orchestrator against the code before being fixed** and both holding. **Both are claims 2d-5-3-D's own fix introduced**, making this the **fourth consecutive round whose entire finding list is its predecessor's fix**. Medium 1: the replacement for a false *coverage* citation states a false *absence* — *"nothing in this repository drives the third state … an edit to that early return falsifies this paragraph with every gate green"* — while `src-tauri/src/watch_check.rs`'s `a_failed_reopen_keeps_the_previous_watcher_watching` opens a real tree, refuses a second open with a non-directory path, and asserts the session **still open at epoch 1, still ready, still delivering a live edit**; the module is `#[cfg(test)]` with no `#[ignore]`, so that edit turns it **red**. **Only the queue half is unpinned.** Medium 2: the paragraph that correctly removed the `list_documents` case from the third state **attributed it to the wrong one of the other two** — a refusal establishes only that `open_workspace` succeeded, and the **lock race** between `drain_external_changes` (via `with_workspace_read`) and `open`'s swap block decides which queue the batch is; it is **one of the first two, whichever the race gave**. **2d-5-3-D's thin item 5 closed by measurement** — all five anchors still resolve (this row said *item 4* until 2d-5-3-F corrected it; item 4 is the unreproduced able-to-fail residue and stays open). The diff is **comment-only, proven mechanically**, `23 10`, in **one source file**, so §7.1 commissions a round and this phase is **`SUPERSEDED BY 2d-5-3-F`**, never complete. Stages `PROGRESS.md`, `docs/` and `src/lib/browser/` **by path**; **no path under `src-tauri/` at all**, though this is the round whose finding came from *reading* a Rust test, and the four harness paths stay uncommitted. Also archives 2d-5-3-D's Next-action prose — 115 lines — with the two claims this round corrected marked at the top of the archived copy** | **`b1c7b4b`** | ✅ pushed to `origin/main` |
| 2d-5-3-E — the SHA and push record | `f9c0344` | ✅ pushed to `origin/main` |
| **2d-5-3-F — the round §7.1 commissioned for 2d-5-3-E's fix. Verdict `ship-with-fixes`, **0 blockers, 0 Medium**, three SHOULD-FIX — one record defect and two Lows — **all three re-derived against the code before being fixed**. **The first round of this tail whose findings are not all in the previous round's fix**, and the first with no Medium. The record defect: `2d-5-3-E-notes.md` §3 closed *"2d-5-3-D's thin item 4"* while describing item **5**, when item **4** is the residue the same round's §7 says it cleared none of — **one file closing and leaving open the same numbered item** — propagated to three positions in `PROGRESS.md`, all four corrected in place. Low 1: *"asserted in five comment paragraphs and tested by none"* was carried into 2d-5-3-E's **own §8 item about not inheriting counts**; enumerated here the answer is **six**, 2d-5-3-E's own fix added the sixth, and *"tested by none"* is false because that round pinned the workspace half in Rust — the item is **left standing with its correction attached**. Low 2, the only source fix: *"never this one"* is true of the batch's **provenance** and short by a case under the **property** reading, because `open()` has **no re-entrancy guard**; the refusal is unaffected and the ambiguity was **inherited from 2d-5-3-C, not introduced**. The diff is **comment-only, proven mechanically**, in **one source file**, so §7.1 commissions a round — **and a Low is what does it**, the case §7.1 was rewritten to cover — and this phase is **`SUPERSEDED BY 2d-5-3-G`**, never complete. Stages `PROGRESS.md`, `docs/` and `src/lib/browser/` **by path**; **no path under `src-tauri/` at all**, and the four harness paths stay uncommitted. Also archives 2d-5-3-E's Next-action prose — 98 lines — with the three claims this round corrected marked at the top of the archived copy** | **`c717e9a`** | ✅ pushed to `origin/main` |
| 2d-5-3-F — the SHA and push record | `91e444a` | ✅ pushed to `origin/main` |
| **2d-5-3-G — the round §7.1 commissioned for 2d-5-3-F's fix. Verdict `ship-with-fixes`, **0 blockers**, **3 Medium** and 2 Low, **all five re-derived against the code before being fixed**. **2d-5-3-F's "first sign of convergence" is disproved.** Medium 1: **one comment block asserts a proposition and its negation ten lines apart** — 2d-5-3-E's *"the half this arm actually rests on — that the batch's `newest_sequence` still indexes the queue Rust is holding"* against 2d-5-3-F's *"nothing here rests on the property"* and 2d-5-3-C's *"never that the queue is gone"*. The code settles it: the arm records the **pre-await** `afterSequence` and returns, and `batch.newest_sequence` is consumed in `accept()` alone, which it never reaches — so **2d-5-3-F's fix created the visible contradiction by being correct**, and `2d-5-3-E-notes.md` §8 item 2 is a work item resting on the false half. Medium 2: the fix's *"no re-entrancy guard … a case-2 batch followed by a later refused open"* construction is **load-bearing on nothing** — in case 2 the batch already is the incoming lifecycle's queue and Rust still holds it — and **the Rust no round of this tail had opened settles it further**: `reconciliation` is a field of `WorkspaceSession`, **not of `Open`**, *"emptied by a replacement rather than replaced by one"*. The unverified claim was **removed, not re-scoped**. Medium 3: *"nothing in this repository drives two overlapping opens"* is **false** — `workspace.test.ts`'s *"lets the newer open win"* runs two — **2d-5-3-E's own Medium 1 recurring in the round that recorded the shape**. Low 1: the replacement count is not re-derivable either (two `'staleOpen'` arms; eight production sites), and **this round asserts no figure**, recording the criterion problem. Low 2: two fresh uncounted counts in one commit. The diff is **comment-only, proven mechanically**, in **one source file**, so §7.1 commissions a round and this phase is **`SUPERSEDED BY 2d-5-3-H`**, never complete. Stages `PROGRESS.md`, `docs/` and `src/lib/browser/` **by path**; **no path under `src-tauri/` at all**, though this is the round whose Medium 2 came from *reading* the `WorkspaceSession` struct in `commands.rs`, and the four harness paths stay uncommitted. Also archives 2d-5-3-F's record and Next-action prose — 101 lines — with the three claims this round corrected marked at the top of the archived copy** | **`c67404d`** | ✅ pushed to `origin/main` |
| **2d-5-3-H — the round §7.1 commissioned for 2d-5-3-G's fix. Verdict `ship-with-fixes`, **0 blockers**, **5 SHOULD-FIX — 2 in source, 3 in the record**, **all five re-derived against the code before being fixed**. Source 1: *"In case 2 the batch already **is** the incoming lifecycle's queue and Rust is still holding that lifecycle … satisfied there outright"* is evaluated **after the await** and nothing gates `open()` on the drain — a further **successful** open installs another lifecycle and `begin_epoch` **empties** the one session-long queue, the very Rust the previous round established — and the overlap is **driven** by `workspace.test.ts`'s *"lets the newer open win, however late the older one answers"*, the same test 2d-5-3-G's own Medium 3 used one round earlier. **The clause this round deleted was the only one carrying the time index**, so the lesson is that **a removal has to check what else the removed clause was carrying**; the paragraph's conclusion is unaffected. Source 5 (Low): *"both say the refusal rests on unattributability"* is false of one referent — *"Which lifecycle the batch describes"* says only that it *"is not knowable here, and the refusal does not need it to be"* — and *"the paragraph above"* acquired a **second** referent in this round's own rewrite; both fixed by naming the sites by opening words. Record 2: §2 dropped *"`open()` has no re-entrancy guard"* **for being unverified** and asserted *"nothing has replaced that lifecycle since"* one sentence later — **same absence, opposite sign** — so **an absence claim is not made safe by being the conclusion of a correction**. Record 3 (Low): §4 writes *"this round gets **eight**"* four lines above *"**no number is written down as the answer**"*, and its `2d-5-3-E-notes.md` §7 block carries the identical pair — **the round's own Medium 1, in the section written to retire the count**; the ruling stands, **neither number is re-derived**. Record 4 (Low): three further uncounted counts, of which *"nominated a citation checker **five** times"* is falsified by two archived blocks both saying *"four times"* — the round swept for **the words of its own Low 2** rather than for the shape. The diff is **comment-only, proven mechanically**, in **one source file**, so §7.1 commissions a round and this phase is **`SUPERSEDED BY 2d-5-3-I`**, never complete. Stages `PROGRESS.md`, `docs/` and `src/lib/browser/` **by path**; **no path under `src-tauri/` at all**, though this round re-derived the `WorkspaceSession` struct reading in `commands.rs`, and the four harness paths stay uncommitted. Also archives 2d-5-3-G's record and Next-action prose — 112 lines — and, in a **second** archive taken before a word was written, that round's verification narrative — 71 lines — to [`phase-2d.md`](docs/progress-archive/phase-2d.md). **A third archive followed after the record went in**, when the file stood at 794 lines: that header's own headroom narrative — 80 lines — to the same file. This row said *two* until 2d-5-3-I counted them against the header** | **`8e457d1`** | ✅ pushed to `origin/main` |
| **2d-5-3-I — the round §7.1 commissioned for 2d-5-3-H's fix. Verdict `ship-with-fixes`, **0 blockers**, **3 SHOULD-FIX, all three in source** — the first round of this tail whose entire finding list is — **all three re-derived against the code before being fixed**. Finding 1: the previous fix cited *the case-2 sentence* as a second site asserting *the queue half*, which the same paragraph defines one sentence earlier as a property **of the third state**; case 2 is a *successful* open the block calls *"never this one"*, and the paragraph's own falsifiability test — an edit resetting the queue **on the refusal path** — does not reach it. 2d-5-3-H's Low 5 was right that the sentence repeats the property **text**; the fix carried it one step too far, because **repeating a proposition about a different case is not asserting the same claim**. Finding 2: the same paragraph still said *"the paragraph above"* **four lines above** the sentence declaring it names sites by opening words *rather than* saying it — **a paragraph announcing a policy and violating it four lines earlier, inside the fix written to close that shape's sibling** — and the deictic resolved to the wrong paragraph, since what `a_failed_reopen_keeps_the_previous_watcher_watching` de-reasons is asserted in *"A third state is neither of those"*; fixed by opening-words anchor **and** by narrowing the claim to that paragraph's **workspace** half. Finding 3 (Low): a `scriptedCommands()` test cited for the Rust-side *installed another lifecycle and emptied the queue*, nine lines above the block's own *"no scripted-command suite … drives Rust at all"*; re-derived at `workspace.test.ts:1229` and **qualified in place rather than removed**, because the claim it supports is right — the qualification had existed in `PROGRESS.md` and not in the comment where the reader who needs it is. **The sweep found a fourth deictic the review did not name**, at the end of the same block, whose referent is the block's **first** paragraph five up with four nearer candidates; it is outside the two passages §7.1 scoped, because **a scope stated as a count of passages invites a sweep bounded by that count**. One `NOT-VERIFIED` item was chased rather than carried: 2d-5-3-H's git-state row named **two** archives where that round's header named **three**, corrected in place here. The diff is **comment-only, proven mechanically**, in **one source file**, so §7.1 commissions a round and this phase is **`SUPERSEDED BY 2d-5-3-J`**, never complete. Stages `PROGRESS.md`, `docs/` and `src/lib/browser/` **by path**; **no path under `src-tauri/` at all**, though this round re-read `watch_check.rs:514` to settle finding 2's referent, and the four harness paths stay uncommitted. Also archives 2d-5-3-H's record and Next-action prose — 123 lines — and that round's verification narrative — 55 lines — to [`phase-2d.md`](docs/progress-archive/phase-2d.md), each with its corrections marked at the top** | **`eec0b70`** | ✅ pushed to `origin/main` |
| **2d-5-3-J — the round §7.1 commissioned for 2d-5-3-I's fix. Verdict `ship-with-fixes`, **0 blockers**, **3 SHOULD-FIX including one Low, all three in source** — the **second consecutive** round of which that is true — **all three re-derived against the code before being fixed**. **Two of the three are claims the previous fix added.** Finding 1: the `workspace.test.ts` citation was credited with pinning *"that the overlap is reachable"*, but the overlap its sentence means is an open landing while **this drain's await** is outstanding, and `workspace.test.ts:1229` **never calls `state.start()`** — with `workspace.svelte.ts:3502`'s `start(): void { reconciliation.start(); }` the only route to the coordinator, **no drain is issued in that test at all**; it overlaps two *opens with each other*. `reconciliationCoordinator.test.ts:750`, *"installs nothing from a drain an open overtook"*, drives the real overlap on the **injected** host and is cited instead; the old clause is **kept and restated**, never deleted, because it entered at 2d-5-3-H to answer 2d-5-3-G's Medium 3 and deleting it would re-create that false absence claim — **a removal has to check what else the removed clause was carrying**. Finding 2: *"which that function's own doc comment states in as many words"* is **false of the queue half** — `commands.rs:625-627` and `:679-681` name the workspace **and its watcher**, `:650-651` is the doc's only queue sentence and describes the **success** path, and the same block says nine lines down that the half is *"reasoned from `WorkspaceSession::open` rather than executed"*, so this was an assert-and-negate pair. **The review's own derivation was incomplete and the finding survived it**: it cited `:679-681` alone and missed the stronger `:625-627`, whose *"returns before touching the session"* would **entail** the queue half — entailment is not literal statement. Finding 3 (Low), both parts introduced by the previous fix: a **forward positional deictic six lines under the sentence declaring the comment names sites by opening words**, and an *"and"* replaced by a second *"so"*. **The sweep widened 2d-5-3-I's single `rg` pattern**, which that round's own §7 item 9 nominated as its likeliest miss, and re-anchored **two** further paragraph references — both **pure re-anchors adding no proposition** — while **leaving three positional phrases standing and recorded**: a code reference, a plural description and a quoted mention. **The 123 / 55 / 80 archive figures the review flagged as uncounted were closed by measurement, all three exact.** The diff is **comment-only, proven mechanically** — twice, because a second edit followed a green reading — in **one source file**, so §7.1 commissions a round and this phase is **`SUPERSEDED BY 2d-5-3-K`**, never complete. All four gates were run **three** times at `1320 / 441 / 2307 / 188`. Stages `PROGRESS.md`, `docs/` and `src/lib/browser/` **by path**; **no path under `src-tauri/` at all**, though this round read the whole of `WorkspaceSession::open`'s doc comment and **quoted two of its sentences into the TypeScript comment**, and the four harness paths stay uncommitted. Also archives, **five times, every one before a word of the record was written**: 2d-5-3-I's record and Next-action prose (110 lines), its verification narrative (59), this header's headroom narrative (52), the chain's per-round staging history (17), and **the four superseded status rows of 2d-5-3-C through F** to [`status-table.md`](docs/progress-archive/status-table.md). The four narrative archives left the file **4,733 bytes above** what it inherited; **the rows turned it, and this is the first round of the chain to finish smaller on both bounds** — which is why archive rule 2 now says a superseded row may move while a live chain's head may not** | **`3428cde`** | ✅ pushed to `origin/main` |
| **2d-5-3-K — the round §7.1 commissioned for 2d-5-3-J's fix. Verdict `ship-with-fixes`, **0 blockers**, 3 SHOULD-FIX, **all three re-derived by the orchestrator before being fixed** and all three holding — **one in source, two in the record**, which ends the two-round run of all-source lists. **The round's sharpest defect is one the review never saw and no gate could**: its own replacement sentence claimed that *every* `open()` in the cited test reaches `workspaceReady()`, and the comment eleven lines above that call site enumerates three early returns leaving it unreached, the first being the **superseded generation** that the cited test's losing open takes. Caught during the writing, before any gate ran — which is also why this round measured **twice** where 2d-5-3-J measured three times. Finding 1: *"it never calls `start()`, so no coordinator runs in it"* is a **false attribution** — `createBrowserState` constructs the coordinator unconditionally, every `open()` calls `workspaceOpened()` synchronously before its first await, and the winner reaches `workspaceReady()`, whose `requestDrain('workspaceOpened')` is then **remembered** rather than dropped because `drainMayStart()` is false; what `start()` gates is the **drain**, so the conclusion holds on a corrected reason. Its neighbouring repository-wide absence claim, returned `NOT-VERIFIED`, was chased as far as a grep goes and then **narrowed to the two witnesses** the paragraph's own derivations pin. Finding 2: **three line anchors in `2d-5-3-J-notes.md` do not resolve**, one of them the **inherited** tree's line — stale inside the commit that wrote it, 2d-5-3-C's shape, cited by that file's own §7 item 3 — and **a fourth was found by the sweep, not by the review**; all four numbers **dropped rather than corrected**, since this round's fix moved three of the four phrases again. Finding 3: *"Three positional phrases stay"* omits two of its own sweep's matches, one of them added by the fix it records. **The review's own arithmetic was corrected rather than accepted, for the second consecutive round.** Every gate green **twice** at `1320 / 441 / 2307 / 188`; the source diff is comment-only, proven mechanically twice, in **one** file, so §7.1 commissions a round and this phase is **`SUPERSEDED BY 2d-5-3-L`**, never complete. Stages `PROGRESS.md`, `docs/` and `src/lib/browser/` **by path** and **no path under `src-tauri/`**, though this round read more of `commands.rs` than any round before it. **Four narrative archives, all before a word of the record** — 124 + 62 + 50 + 19 lines — **and they were again not enough**: with the record written the file still measured above what it inherited, so the **superseded status rows of G and H** followed, and then **I** when a second measurement, taken after this very row went in, said two were still short** | **`aa025fa`** | ✅ pushed to `origin/main` |
| **2d-5-3-L — the round §7.1 commissioned for 2d-5-3-K's fix. Verdict `ship-with-fixes`, **0 blockers**, **2 SHOULD-FIX, both in source and both re-derived before being fixed**; the reviewer's arithmetic held. Finding 1: the two-witness sentence attributed *driving* to a test that issues no drain — replaced by a claim about the two cited tests, retiring the unpinnable *nearest* half. Finding 2: `workspaceReady()`'s body is two statements and the omitted one is the gate. A host finding cost the inherited-tree Rust reading: a stale build cache from the repository's previous location, in two places, cleaned with a full `cargo clean`. Every gate green **once** on the committed tree: `1320 / 441 / 2307 / 188`, 26 `test result` lines with none lacking `0 failed`, both bundle oracles read. Stages `PROGRESS.md`, `PROGRESS.json`, `CLAUDE.md`, `docs/` and `src/lib/browser/` by path; nothing under `src-tauri/`; the four harness paths stay uncommitted. Four narrative archives (118 + 54 + 42 + 22 lines) before a word of the record, no status row moved. **`SUPERSEDED BY 2d-5-3-M`**** | **`c39831f`** | ✅ pushed to `origin/main` |
| **2d-5-3-M — the round §7.1 commissioned for 2d-5-3-L's fix. Verdict `ship-with-fixes`, **0 blockers**, **2 SHOULD-FIX — one in source, one in the record — both re-derived before being fixed and both holding**. Reviewed by **Codex** (`autoclaude-review.sh` exited 0, so no agent was spawned): the **second provider** on this tail, and its report's finding bodies arrive **truncated**, so both findings were re-derived from the code rather than accepted. The Medium: L's replacement parenthesis turned a definite claim about one test's superseded open into a **universal** that `open()` does not give — no generation check and no await between the per-document loop's end and `workspaceReady()`, and an injected `report` called inside that loop — rewritten scoped to the cited test and to the check **directly under its own `openWorkspace` await**. The Low: the lifecycle suite holds **ten** tests and closes at **7779**, not eleven at 7790; **two** numbers wrong — the **range** dropped and the **count** corrected to ten *(that clause read "both dropped rather than renumbered" and is corrected by 2d-5-3-N)*. Every gate green on **two** full runs, inherited tree and post-fix: `1320 / 441 / 2307 / 188`, 26 `test result` lines with none lacking `0 failed`, both bundle oracles read — **the two-reading convention restored**, L's stale-`target/` host finding having not recurred. Stages `PROGRESS.md`, `PROGRESS.json`, `docs/` and `src/lib/browser/` by path; nothing under `src-tauri/`; the four harness paths stay uncommitted. Three narrative archives (93 + 40 + 29 lines) before a word of the record, no status row moved. **`SUPERSEDED BY 2d-5-3-N`** | **`1e80603`** | ✅ pushed to `origin/main` |
| **2d-5-3-N — the round §7.1 commissioned for 2d-5-3-M's fix, and the round that CLOSES the 2d-5-3 tail.** Verdict `ship-with-fixes`, **0 blockers**, **2 SHOULD-FIX, both Low and both in the record**, both re-derived before being fixed and both holding. Reviewed by **Codex** (`autoclaude-review.sh` exited 0, so no agent was spawned), its finding bodies **truncated** again, so both were re-derived rather than accepted — finding 2 from `2d-5-3-F-notes.md` directly, its reviewer's reasoning having broken off mid-sentence. Finding 1: *"both numbers are dropped rather than renumbered"* is disproved by the replacement quoted beside it — the **range** dropped, the **count** renumbered to **ten**; M's suite figures are right and were re-counted. Finding 2: the *"twelve of the thirteen … exception 2d-5-3-F"* tally is false by F's own header (*"one is"*), and is **dropped rather than renumbered** because renumbering asserts an audit nobody has run. **The source clause holds**, re-derived at `open()` 2603/2604 and `workspaceReady()` 2687. Every gate green on **two** full runs, inherited tree and post-fix: `1320 / 441 / 2307 / 188`, 26 `test result` lines with none lacking `0 failed`, both bundle oracles read, the instrument's pin holding at `5 insertions(+), 1 deletion(-)`. **The fix changed no source file** — `PROGRESS.md`, `PROGRESS.json` and `docs/` only — so §7.1 commissions no round and §7.2 closes the step: **the fourth tail ended by rule, at fourteen rounds the longest.** Stages `PROGRESS.md`, `PROGRESS.json` and `docs/` by path; nothing under `src/` or `src-tauri/`; the four harness paths stay uncommitted. Two narrative archives (38 + 25 lines) plus the header's own paragraphs before a word of the record, no status row moved. **COMPLETE — not superseded** | **`a8bb43f`** | ✅ pushed to `origin/main` |

| **2d-5-4 — the observation state transitions, step 4 of the seven. The first new implementation work since 2d-5-3: `observationTransitions.ts` and its suite are new, `reconciliationCoordinator.ts`, `workspace.svelte.ts` and both their suites are changed, and `DetailPane.svelte` takes a **comment-only** correction the phase did not plan — its `tellNobodyYet` JSDoc claimed nothing in the repository invoked a stored transition, which this phase falsified. Review **Codex, `ship-with-fixes`, 2 blockers and 3 SHOULD-FIX**, bodies **truncated again**, so **all five were re-derived from the code and all five held**; all five fixed in this commit. New rung `1320 / 443 / 2380 / 189`, the first move since 2d-5-2c-1. **The fix changed six source files, so §7.1 commissions Phase 2d-5-4-A** and this phase is complete with a round owed. Stages `PROGRESS.md`, `PROGRESS.json`, `docs/`, `src/lib/browser/` and `src/lib/components/DetailPane.svelte` **by path** — **no path under `src-tauri/` at all**, and the four harness paths stay uncommitted. Also archives 2d-5-3-N's closing record, the Next-action prose this phase executed, its verification narrative and the ladder narrative — 56 + 30 + 32 + 13 lines** | **`81e54db`** | ✅ pushed to `origin/main` |
| **2d-5-4-A — the round §7.1 commissioned for 2d-5-4's fix.** Verdict `ship-with-fixes`, **2 blockers and 4 SHOULD-FIX**, reviewed by **Codex** (`autoclaude-review.sh` exited 0, so no agent was spawned — three consecutive Codex rounds), bodies **truncated again**, so **all six were re-derived from the code by a read-only worker and five of them spot-checked by the orchestrator; all six held** — five in source, one in the record **and** in source. The two blockers were one defect: `open()` retained the commands' own projection objects, so `installView`'s `id` comparison over `views` and `repairAfter`'s reads of `next.matches` ran caller-controlled accessors **after** the final guard, and 2d-5-4's own fix had written into source that `replaceSelection` bounds the repair — which it does not, it bumps a counter. Fixed at **ingress**: `ownedProjectionOf` copies field by field at all nine of them, typed so a new required field is a compile error, and its JSDoc names the two-level depth and what is still the command's object below it. Three SHOULD-FIX were a second single defect — a status write that never asks whether it still owns the status — fixed by a per-document write token, by fencing the two guard arms above the ownership question **without touching the decision order**, and by moving the clear into the installation block so an explicit reread can clear a mark that had been permanent. The fourth was a reachability claim false in the record **and** in source: `readFileText()` sends `document_text` after a reread installs. Every gate green on the post-fix tree: `1320 / 443 / 2389 / 189`, 26 `test result` lines with none lacking `0 failed`, both bundle oracles read, the instrument's pin holding at `5 insertions(+), 1 deletion(-)`. Nine cases pin the six fixes and **each was confirmed to fail against the pre-fix code**; two candidates were discarded for passing both ways. Stages `PROGRESS.md`, `PROGRESS.json`, `docs/` and `src/lib/browser/` by path; nothing under `src-tauri/` and no `.svelte` file; the four harness paths stay uncommitted. Two narrative archives (128 + 33 lines) before a word of the record, no status row moved. **The fix changed four source files, so §7.1 commissions Phase 2d-5-4-B. `SUPERSEDED BY 2d-5-4-B`** | **`ee78429`** | ✅ pushed to `origin/main` |
| **2d-5-4-B — the round §7.1 commissioned for 2d-5-4-A's fix.** Verdict `ship-with-fixes`, **2 blockers and 4 SHOULD-FIX**, reviewed by **Codex** (`autoclaude-review.sh` exited 0, so no agent was spawned — **four consecutive Codex rounds**), bodies **truncated again**, so **all six were re-derived from the code by a read-only worker and five of them spot-checked by the orchestrator; all six held** — five in source, one in the record — **and the re-derivation found three the review missed**. Blocker 1: `open()` normalizes **after** its last generation check, so the **final** document's getters and the injected `report` run between that check and `views = projected; status = 'ready'`; a re-entrant `open()` watched the superseded configuration install itself and open the coordinator's drain gate. Fixed by a second generation check after the loop. Blocker 2: `ownedMatchOf` kept `id: match.id`, so `positionOf`'s `match.id.node` read sits between the three adoptions' identity guard and their `replaceSelection`; fixed by `ownedMatchIdOf`, and by `ownedIdentityOf` for the `target`/`moved` a save answer carries. Three SHOULD-FIX were one question — *does this writer still own what it is writing?* — fixed by fencing the explicit reread's **clear** alone with a fourth capture (the install deliberately left unfenced), by `ownedSummaryOf` at both `DocumentSummary` ingresses, and by routing the transitions guard's two lower `stale` writes through the fenced writer. The sixth separated four numbers the record had written as one. Every gate green on the post-fix tree: `1320 / 443 / 2395 / 189`, 26 `test result` lines with none lacking `0 failed`, both bundle oracles read, the instrument's pin holding at `5 insertions(+), 1 deletion(-)`. Six cases pin the five source fixes and **each was confirmed to fail against the pre-fix code**; no candidate was run and found to pass both ways. Stages `PROGRESS.md`, `PROGRESS.json`, `docs/` and `src/lib/browser/` by path; nothing under `src-tauri/` and no `.svelte` file; the four harness paths stay uncommitted. Two narrative archives and **three superseded status rows** — J's, K's, L's and M's, the first rows this chain has taken out of reserve. **The fix changed four source files, so §7.1 commissions Phase 2d-5-4-C. `SUPERSEDED BY 2d-5-4-C`** | **`834ed1b`** | ✅ pushed to `origin/main` |
_The round-by-round §7.1 reading for the closed 2d-5-2b chain, the hatch condition C set and D
applied, what the five rounds bought, and the stale-citation sweep taken while E ran, are in
[`status-table.md`](docs/progress-archive/status-table.md) under *"The git-state prose of the closed
2d-5-2b chain"*, archived 2026-09-05. `docs/decisions/2d-5-2b-notes.md` §13-§17 is the authoritative
per-round record. The one finding that outlived that tail — **four stale cross-file citations in
`src/`** — is live in *Next action* above, as a candidate corrective phase._
