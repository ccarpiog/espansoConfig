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

**Where the headroom stands, measured on the finished file rather than predicted before it:**
**708 lines and 82,567 bytes** — 16.6 KiB over the 64 KiB soft bound, and well past the
400-line one. **It is over soft, the figure is re-measured on this file rather than inherited, and it is
the honest one.**

**The archive-on-state rule was exercised at 2d-5-2a-C rather than merely restated.** The 2d-5-2a
chain closed, and its narrative and four status rows went to
[`status-table.md`](docs/progress-archive/status-table.md) **in the same session that closed it**,
leaving one summary row and a pointer — which is what this header had asked the closing session to do.
The chain had been growing the live head by roughly **50 lines per corrective phase** (581 at
2d-5-2a, 644 at 2d-5-2a-B), and the archive is why closing a four-phase chain left the live head
**one line shorter than it found it** — 644 → 643 — instead of fifty longer. **The rule stays *archive on state, not on length***, and the precedent that matters
is still the refusal: 2d-4b-G wanted a live chain's rows and did not take them, because *superseded*
is not *closed*. **2d-5-2a's rows were taken the moment they stopped being live, and not one phase
earlier.**

**Two more moves landed at 2d-5-2b, both on state rather than on length.** The 2d-5-1 and 2d-5-2a
**git-state** rows — 14 of them, one of which is `d1d9d13`, itself an earlier archiving commit — went
to [`status-table.md`](docs/progress-archive/status-table.md), leaving one summary row; and the
superseded 2d-5-1/2d-5-2a **verification narratives** went to
[`phase-2d.md`](docs/progress-archive/phase-2d.md), because 2d-5-2b re-measured every figure on its own
tree. The live head still grew — it carries a new chain's record — and **that is the rule working, not
failing**: 2d-5-2b's own rows stay because 2d-5-2b-A is owed, so that chain is live.

Six things left the live head across 2d-5-2a
and 2d-5-2a-A and the two steps' records still cost more than they saved. What moved, so nobody
looks for it here — the 2d-5-1 closure narrative *and* the 2d-5-2a one, both to
[`next-action-history.md`](docs/progress-archive/next-action-history.md); two ladder rungs and the
three 2d-4b residues, to [`phase-2d.md`](docs/progress-archive/phase-2d.md); and the closed-risk
index, to [`decisions.md`](docs/progress-archive/decisions.md). **Archiving on state rather than on
length is the rule**, and the precedent that matters is still the *refusal*: 2d-4b-G wanted a live
chain's rows badly and did not take them, because *superseded* is not *closed*. **The 2d-5-2a chain
is live, so its rows stay** until it closes — which is exactly why this file is over soft and will
stay over soft while the chain runs. 2d-4b-H
closed the eight-row 2d-4b chain and its status rows went to the archive on 2026-08-31; its **git-state**
rows stayed in the live head another four days, and 2d-5-1-B is what took them, together with 2d-4a's.
**The next session that closes a 2d-5 step should archive that step's narrative as it goes**
rather than at the bound, and the precedent that matters is the *refusal* rather than the move: 2d-4b-G
wanted the chain's rows badly, they were the longest thing in the table, and it did not take them,
because *superseded* is not *closed*. Archiving on length rather than on state is how a live chain
loses its head.

- Plan of record: [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md) (§12 holds the phase plan).
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
| **2d-3** | The write ledger and the admission gate | ✅ complete — **CLOSED at 2d-3-C (2026-08-26)**, after a fourteen-round tail the owner ended |
| **2d-4a** | The Rust half of the reconciliation wire — the queue, `ReconciliationWake`, `drain_external_changes`, the wire types, the EN/ES JSON | ✅ **complete and CLOSED at 2d-4a-H (2026-08-30)**, after a **thirteen**-round tail — the first tail this project has ended **by rule** rather than by an owner ruling (`CLAUDE.md` §7.2). Superseded through D → E → F → G → H, each by its successor |
| **2d-4a-D … 2d-4a-H** | The five corrective phases of 2d-4a's tail — review rounds 9 to 13, each one the review of its predecessor's fix | ✅ **the chain is complete and CLOSED at 2d-4a-H (2026-08-30)**; D, E, F and G are each superseded by the next. Round 13's fix changed no source file, so §7.1 commissioned nothing and the tail ended **by rule** — the first this project has ended that way. Verdicts, counts and dispositions per round are in [`docs/progress-archive/status-table.md`](docs/progress-archive/status-table.md) under *"the 2d-4a corrective chain"*; the notes are `docs/decisions/2d-4a-notes.md` §22 |
| **2d-4a-C-1** | The scoped-lifetime contract, stated once, and its pointers | ✅ complete and **CLOSED** — four rounds, round 4 READY with 0 findings |
| **2d-4a-C-2** | The check that keeps it — `src-tauri/src/prose_sweep.rs` and `src-tauri/src/retained_state_contract.rs` | ✅ implemented, every gate green, **CLOSED by owner decision 2026-08-29** after nine rounds |
| **2d-4b design consult** | 2d-4b put to a design consult before any line of it was written, per the standing rule since 2b-2c | ✅ complete (2026-08-30) — [`docs/reviews/phase-2d-4b-design.md`](docs/reviews/phase-2d-4b-design.md), **Codex at high effort**, the **second provider** on this phase since 2d-4a began. Verdict *proceed as one coherent wire step*; it added a general key-without-accessor check and one bounded correction (`duplicateSeam`) that check exposes |
| **2d-4b** and its seven corrective phases (**B … H**) | The TypeScript half of the wire — the mirror, the drain wrapper, the injectable event source, the i18n accessors, and the deletion of `AWAITING_FRONTEND_DECLARATION` — then eight review rounds over it, of which C to H were all about **one comment block** in `workspace.test.ts` | ✅ **complete and CLOSED at 2d-4b-H (2026-08-31)**, after an **eight**-round tail — the **second** this project has ended **by rule** rather than by an owner ruling (`CLAUDE.md` §7.2), after 2d-4a's. Round H found **no defect in either source hunk** and all four of its findings in the record, so its fix changed no source file and §7.1 commissioned nothing. B … G are each superseded by the next. Per-round scopes, verdicts and dispositions are in [`docs/progress-archive/status-table.md`](docs/progress-archive/status-table.md) under *“The 2d-4b corrective chain”*; the notes are `docs/decisions/2d-4b-notes.md` §8–§14 |
| **2d-5 design consult** | 2d-5 put to a design consult before any line of it was written, per the standing rule since 2b-2c | ✅ complete (2026-08-31) — [`docs/reviews/phase-2d-5-design.md`](docs/reviews/phase-2d-5-design.md), **Codex at high effort**, the **second provider** to see this material since 2d-4a began. Verdict: cut 2d-5 into **seven** dependency-ordered steps; it overrides `phase-2d-design.md` in two places. The record is [`docs/decisions/2d-5-split-notes.md`](docs/decisions/2d-5-split-notes.md) — 35 binding rulings and a 67-row citation audit — and its own review was `ship-with-fixes`, 0 blockers, 5 SHOULD-FIX, all five fixed in the record |
| **2d-5** | The browser coordinator and the open-write-surface registry — seven steps, of which two touch components | 🔶 in progress — **step 1 of 7 is complete and CLOSED**, tail and all; **step 2 is under way, split three ways, and 2d-5-2a is complete** |
| **2d-5-1** and its three corrective phases (**A, B, C**) | The surface and conflict vocabulary — the widened `OpenWriteSurface` union, the two predicates, `ConflictSource`, the memos, the EN/ES origin lines — then three review rounds over it, of which B and C were about comment text | ✅ **complete and CLOSED at 2d-5-1-C (2026-09-04)**, after a **four**-phase tail — the **third** this project has ended **by rule** rather than by an owner ruling (`CLAUDE.md` §7.2). Round C found nothing, so its fix changed no source file and §7.1 commissioned nothing. Per-phase scopes, verdicts and dispositions are in [`docs/progress-archive/status-table.md`](docs/progress-archive/status-table.md) under *"The 2d-5-1 corrective chain"*; the notes are `docs/decisions/2d-5-1{,-A,-B,-C}-notes.md` |
| **2d-5-2** | The exhaustive live registry — **split three ways by the orchestrator on 2026-09-04** (2c-5-4a/4b's precedent): **a** the registry as a value, **b** the `DetailPane` assembly with `MatchCreator` reporting upward and all the mounted evidence, **c** the narrow window regression reading | 🔶 in progress — **step a is complete and CLOSED**, tail and all; **step b is complete and its review is taken**, with **2d-5-2b-A OWED** under §7.1; **2d-5-2c is not started** |
| **2d-5-2a** and its three corrective phases (**A, B, C**) | The coordinator-owned keyed write-surface registry — `src/lib/browser/writeSurfaceRegistry.ts` and its `BrowserState` wiring — then four review rounds over it, of which B and C changed **only comments and records**. **Components: none, in all four** | ✅ **complete and CLOSED at 2d-5-2a-C (2026-09-04)**, after a **four**-phase tail — the **fourth** this project has ended **by rule** rather than by an owner ruling (`CLAUDE.md` §7.2). Round 4's two findings were **both record-only**, so its fix changed no source file and §7.1 commissioned nothing. **Every phase of this chain created a new instance of one defect while fixing an old one** — *a sentence true of a narrow case written as though true of the module* — four generations in four phases, and the fourth landed **inside the record written to fix the third**. Per-phase scopes, verdicts and the argument for why that closed rather than `BLOCKED` are in [`docs/progress-archive/status-table.md`](docs/progress-archive/status-table.md) under *"The 2d-5-2a corrective chain"*; the notes are `docs/decisions/2d-5-2a{,-A,-B,-C}-notes.md` |
| **2d-5-2b** | The exhaustive live registry made **live** — the `satisfies Record<OpenWriteSurfaceKind, …>` assembly in `DetailPane`, all seven kinds registering through leases, `MatchCreator` reporting its destination upward, and the pane's own competing producer deleted. **Components: yes** — the first phase of this chain that touches one | ✅ implemented, every gate green, review 1 `ship-with-fixes` (**0 blockers**, 4 SHOULD-FIX, **all four fixed in this same commit**). 🔶 **2d-5-2b-A is OWED**: the fix round changed source, so `CLAUDE.md` §7.1 commissions a round and §7.4 carries it as a corrective phase. The notes are `docs/decisions/2d-5-2b-notes.md`; the review is `docs/reviews/phase-2d-5-2b.md` |
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

**Twelve Phase 0 substrate rows moved to the archive at 2d-4b-E** — R1, R2, R5, R9, R10, R11, R13,
R15, R18, R22, R23 and R26, verbatim and unedited, in
[`docs/progress-archive/phase-0.md`](docs/progress-archive/phase-0.md) under *"The Phase 0 substrate
risk rows"*. **None is withdrawn or downgraded**; they are open risks recorded outside the live head,
which had 727 bytes of headroom under its 64 KiB soft bound. Three Phase 0-era rows deliberately
**stayed**, because a later phase reads them here rather than in the archive: **R12**, **R16** (its
open half is what D2u constrains) and **R25** (named in *Standing rules*). A session touching the
Phase 0 substrate reads the archive section as part of this table.

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

### Phase 2d-5-2b is implemented, reviewed, fixed and committed — and the registry is **live**.
### The next action is **Phase 2d-5-2b-A — the review round §7.1 commissions for 2d-5-2b's fix**.

#### Why a round is owed, so nobody has to decide it

2d-5-2b's one review returned `ship-with-fixes`, **0 blockers**, four SHOULD-FIX findings, and **all
four were fixed in the same commit**. That fix round changed **source** — `workspace.svelte.ts`
substantively, plus comments in three more source files and two test files — so `CLAUDE.md` §7.1
commissions a round, scoped to that fix. The autoclaude workflow caps a phase at one review
invocation and that cap outranks §7 (§7.4), so the debt is **carried as a corrective phase rather
than written off**: that phase is 2d-5-2b-A, and its review is the round §7.1 already commissioned.

**Scope it to the fix, not to the phase.** The four findings and what answered them are
`docs/decisions/2d-5-2b-notes.md` §12; the review itself is `docs/reviews/phase-2d-5-2b.md`. The
sharpest thing for that round to attack is named under *"What the fix changed"* below.

#### What 2d-5-2b shipped

`src/lib/components/DetailPane.svelte` holds one
`const openSurfaces: PaneWriteSurfaces = $derived({…} satisfies Record<OpenWriteSurfaceKind, PaneWriteSurface>)`,
where `PaneWriteSurfaces` is the mapped type `{[K in OpenWriteSurfaceKind]: (OpenWriteSurface & {kind: K}) | null}`
— **derived from the shipped union rather than re-spelled**, so an entry cannot be filed under
another kind's key and a second definition cannot drift from the first. One `$effect` runs
`reconcileWriteSurfaces`, which asks for the only three differences that can exist — a kind opened,
a kind closed, a target moved — and **never tears down and rebuilds**, because every registration
moves the generation consult Q5 makes a coordinator's guard. The effect returns **no** cleanup
deliberately (an effect's cleanup runs before every re-run, so returning disposal would return every
lease on a keystroke); teardown is `onDestroy`.

`MatchCreator.svelte` gained a **required** `reportDestination` prop driven by an effect over
`matchCreationView(session).chosen`, so the creator's `unknown` → document move goes through the
lease's `replaceTarget` **in place**, and that method's answer is read — `staleLease` re-registers.
The pane's hand-built `openWriteSurfaces()` producer is **deleted**; `RestorePane`'s `surfaces`, and
therefore `restoreDocument`'s argument, now come from the registry.

**The compile-error demonstration is this step's central evidence and the orchestrator re-ran it on a
key it chose itself** (`restore`, not the implementer's `matchMover`): deleting it produces **two**
independent errors, one at the `PaneWriteSurfaces` annotation and one at the `satisfies`, and
restoring it returns `npm run check` to 0/0.

#### What the fix changed — and the measurement that justified it

**The review found a reactivity regression this phase had introduced, and measuring it made it worse
than the finding claimed.** `browser.openWriteSurfaces()` reads a plain `Map` —
`createWriteSurfaceRegistry` is deliberately rune-free — so `RestorePane`'s
`current = $derived.by(…)` lost every dependency that opening or closing a surface moves. The
producer this phase deleted closed over six `$state.raw` sources and had one.

**Measured, not reasoned** (`2d-5-2b-notes.md` §12.1): opening the restore, within one `flushSync()`,
the child's `$derived.by` runs **before** the host's registration `$effect` — and on the unfixed tree
**it never ran again**. So `current.context.surfaces` was `[]` for the life of that restore. The
under-refusal was **total, not a narrow window**, and finding 2's claim was **false rather than merely
unobservable**.

**The fix is a mirror at the door, not in the pane**, and the measurement is exactly why: a dependency
on the pane's own assembly would have re-run the child's derived *before* the reconciler touched the
registry, trading one stale answer for another. `BrowserState` now copies the registry's own
`generation()` into a `$state` number, updated after the registration and — through a
`mirroringLease()` wrapper — after the lease's unregister and `replaceTarget`;
`openWriteSurfaces()` reads it for the dependency (`void surfaceGeneration`) and
`writeSurfaceGeneration()` answers it. **`writeSurfaceRegistry.ts` itself was not changed** — its
diff is comment-only, mechanically verified — so the registry stays framework-free and the runes live
in the runes file.

**The orchestrator verified the new assertions are not vacuous rather than accepting the claim**:
deleting `void surfaceGeneration` from `workspace.svelte.ts` fails exactly the two cases findings 1
and 2 produced (*"gives the restore its surfaces from the registry, itself included"* and *"shows the
restore a surface that opened after its derived had run"*), and restoring it returns the suite to 23
passed.

**The sharpest thing for 2d-5-2b-A to attack**: the mirror is **kept by hand and no type enforces
it** — the three operations that can move the live set are today's whole set, and a fourth written
without a `noticeWriteSurfaces()` would leave the number behind the registry with nothing failing.
That is `2d-5-2b-notes.md` §11 item 9, marked *actionable*. Also worth the budget: `mirroringLease`
cannot preserve the lease's **identity**, so a caller comparing the value it was handed with one the
registry minted would find two different functions and nothing in the type says so (§11 item 10).


#### Where 2d-5-2 stands

`docs/decisions/2d-5-split-notes.md` and `docs/reviews/phase-2d-5-design.md` both describe 2d-5-2 as
one step. **The orchestrator split it three ways on 2026-09-04**, before any line of it was written,
following this project's own 2c-5-4a/4b precedent — *"the coordinator wiring, with nothing drawn"*,
then *"the screen and the phase's whole mounted evidence"*:

- **2d-5-2a** — the coordinator-owned keyed registry as a value. **Components: none.** ✅ **complete
  and CLOSED** (`15ada19`, `9f32cc5`, `52ff829`, and 2d-5-2a-C's commit below), after a four-phase
  review tail that ended **by rule**.
- **2d-5-2b** — the exact `satisfies Record<OpenWriteSurfaceKind, …>` assembly in `DetailPane`,
  `MatchCreator` reporting its chosen destination upward, and **the phase's whole mounted evidence**:
  all seven kinds, the creator's unknown→known transition, restore's unchanged behaviour, and the
  `invalidateEverySurface` coverage gap. **Components: yes.** ✅ **implemented, reviewed and
  committed**, with **2d-5-2b-A owed** for the fix round — see the top of this section.
- **2d-5-2c** — the narrow window regression reading, which **may not claim real watcher delivery**
  (`2d-5-split-notes.md` §7 item 7). ⬜️ not started. **It is a separate step because the instrument
  no longer exists**: every prior reading ran out of `/private/tmp/espansoconfig-harness-2c-5/`,
  which 2c-5-7 removed and which is not on disk today (checked at 2d-5-2a). Rebuilding it was a whole
  sub-phase twice already (2c-5-5a, 2c-5-5b). **A window reading is still owed and is not
  discharged.**

Nothing about the split changes what 2d-5-2 delivers. The consult still binds; the three steps'
deliverables union to exactly the one step it specified.
#### What `writeSurfaceRegistry.ts` is now, after all four phases

`src/lib/browser/writeSurfaceRegistry.ts` is **plain TypeScript, no Svelte runes**, beside
`workspace.svelte.ts` rather than inside it — which settles `2d-5-split-notes.md` §6 item 2
(*"the consult does not say where the coordinator lives"*) for this step, because that file is
already 3 588 lines and 2d-5-3, 2d-5-4 and 2d-5-5 each add more coordinator machinery to it.

It holds one live entry per `OpenWriteSurfaceKind` in a `Map`. `registerWriteSurface(surface,
transition)` answers the consult's `UnregisterWriteSurface` as a **callable lease** carrying
`replaceTarget(WriteSurfaceDocumentTarget) → 'replaced' | 'staleLease'`. Unregister is idempotent and
**inert once displaced**; `openWriteSurfaces()` snapshots in registration order and a displacing
registration keeps its predecessor's position; `generation()` moves for all three mutators and for no
no-op; `transitionFor(kind)` is the only reader of the stored transition, **which nothing invokes** —
2d-5-4/2d-5-5 give it a caller. `BrowserState` owns one instance and exposes `registerWriteSurface`,
`openWriteSurfaces()` and `writeSurfaceGeneration()`.

**2d-5-2a-A changed how a surface is stored, and that is the substantive change of the pair.** The
registry now reads the caller's object once per property in a stated order — `kind`, then `target`,
then `target.kind`, then `target.document` — **all before the serial is taken**, and stores a copy it
builds itself, **frozen at both levels** because `Object.freeze` is shallow. So a host that retains
its registered surface and mutates it cannot change what `openWriteSurfaces()` answers, which is what
makes the generation's documented guarantee **true rather than weakened** — the fix the review asked
for. `withTarget` is gone; `replaceTarget` builds through `ownedDocumentSurface(kind, …)` with the
**captured** kind.

**An unrepresentable pairing throws a `TypeError`** — a non-`matchCreator` kind read together with
`target.kind === 'unknown'`, or a discriminant that is neither arm. The throw happens before the
serial is taken. The argument is that reaching it takes a caller who defeated the compiler, and that
inventing a document, storing an unnarrowable value, or dropping the registration silently are each
worse — the last being fail-**unsafe**, since an invisible surface is the answer that permits a
silent reload. **This was the worker's judgement call, not the review's**, and
`2d-5-2a-A-notes.md` §2.4 argues it.

**Two things both phases deliberately did not do**, because the caller that would change is a
component: `restoreDocument` is **not** rerouted through the registry, and `open()` does **not** clear
it. Both are 2d-5-2b's. And **no `satisfies Record<OpenWriteSurfaceKind, …>` assembly exists
anywhere** — the consult puts exhaustiveness in the composition file, and the composition file is a
component.

#### The three open questions 2d-5-2b answered, so a later step does not re-ask them

1. **The frozen surface is safe under Svelte 5.** 2d-5-2a-A made every stored surface a copy the
   registry freezes at both levels, and no component had ever consumed it. Probed under `$state.raw`,
   a proxied `$state`, `$derived`, `$state.snapshot` and array spread: all safe. A cast-away write
   throws `TypeError: Cannot assign to read only property 'kind'` **from the frozen target, not from
   Svelte**, leaving the registry unchanged. **No source finding against `writeSurfaceRegistry.ts`.**
2. **`open()` still does not clear the registry**, and now on evidence rather than on the argument
   2d-5-2a-A's correction block left standing. A registration really does survive an `open()` when its
   host does (a permanent test); `open()` has exactly two production callers, both in
   `AppShell.svelte`, neither reachable with a surface open; and `open()` sets `status = 'loading'`
   synchronously, so `AppShell`'s guard unmounts the pane and the leases come back at the next flush.
   Clearing would be the **unsafe** direction, since an invisible surface is what permits a silent
   reload. **What is thin here is named**: the last link was measured with a throwaway component
   reproducing the guard's shape rather than with `AppShell` itself, and `2d-5-2b-notes.md` §11 item 5
   marks it *actionable* for whichever step mounts `AppShell` (2d-5-7 touches it).
3. **The mount-path `TypeError` is unreachable *by construction* from this pane**, which is what makes
   R32's blank-pane hazard falsifiable at last: every surface comes from compiler-checked object
   literals with no cast and no assertion, and all seven sources are `$state.raw` or a boolean, so no
   proxy and no accessor can run inside the registry's property reads. **It is not unreachable in
   general** — a caller that takes a kind and a target apart and reconciles them with a cast still
   reaches it, which is the caller the registry's own `@throws` describes.

#### What review 4 did not verify, so 2d-5-2b does not assume it did

Review 4 re-derived the chain's one source change against `git show 15ada19:…` and confirmed both its
cases, and it hunted the chain's recurring shape and **found a fourth instance** (below). It did
**not** re-run the four gates or either bundle oracle — the diff was comment-only and the
orchestrator's own runs are the record below — and it did not reproduce the out-of-repo harness the
behaviour tables rest on.

**It also raised, and did not settle, whether `docs/reviews/phase-2d-5-2a-B.md:17,34` are stale.**
They cite `:555-557`, which 2d-5-2a-C's `+8` lines moved. **The orchestrator's ruling: they are not
stale and must not be "fixed".** A review file records what a reviewer said about the tree as it stood
at `5ec011e`; rewriting its citations to match a later tree would falsify the record rather than
correct it. **The live pointers were updated instead** — this file now cites `:555-568`. The rule
generalizes: **a citation in a review file is a historical snapshot; a citation in `PROGRESS.md` or in
a notes file's live prose is a pointer and is maintained.**

#### The fourth-generation instance, and why the chain closed rather than blocking

**This is the most useful thing the chain measured, so it is kept in the live head.** Before review 4
ran, this file recorded that a **fourth** instance of the chain's recurring defect would mean
`BLOCKED` work under §7.2 rather than a round to keep spending. Review 4 found one:
`2d-5-2a-C-notes.md:271` said *"the shipped module has no `kind` route at all"*, which is false —
`registerWriteSurface` reads `surface.kind` at `writeSurfaceRegistry.ts:503`. **It sat inside the
record written to fix the third instance.**

**It did not block, and the reasoning is on the record because the letter of the warning was met.**
`CLAUDE.md` §7.3 reserves blocking for an **actionable item naming a correctness defect in a source
file**; this instance is in a record. Review 4 verified the chain's one source change as correct. And
the fix was prose, so §7.1 commissioned nothing and the tail **terminated** — which is exactly what
the warning was written to detect the absence of. **The clause fired in letter and not in effect.**

**What a later phase should take from this, since the shape has now survived four attempts to kill
it:** it is not fixed by care, and it is not fixed by being told about it — 2d-5-2a-C was briefed on
this exact hazard, in these exact words, and still produced an instance. What *did* catch it every
time was **a reader re-deriving a sentence's scope against the code**, and what never caught it was
re-reading the sentence. Treat *"true of the module?"* as a question to be answered against a file,
never as a stylistic preference.
#### What became of the two items 2d-5-2b inherited

1. **`invalidateEverySurface` is now executed by a test, and its *effect* is still unobservable.**
   The body runs — the coverage gap 2d-5-1-B measured is closed in that narrow sense — but what it
   closes cannot be seen from this pane while `busy` keeps the seven surfaces mutually exclusive.
   **2d-5-1-B's measurement is not superseded** and must not be read as if it were: deleting a line
   from that function still breaks no test in this repository. It stays a coverage bound rather than a
   correctness defect, so §7.3 holds no step open for it. `2d-5-2b-notes.md` §9.1 and §11 item 6 are
   the record; `2d-5-1-A-notes.md` §5 item 1 and `2d-5-1-B-notes.md` §2 are the older one.
   The function also now ends in `stopCreating()` rather than a bare `creating = false`, so the
   creator's reported destination cannot outlive the form.
2. **The five unexecutable literals are gone, because the producer is gone.** 2d-5-1-C's measurement
   said five of `openWriteSurfaces()`'s six entries could not execute at all — its one caller sat
   inside the `{:else if restoring !== null}` arm, so `busy` had already made the other five null.
   2d-5-2b **deleted that producer**; the assembly that replaced it is conditioned on no arm, so all
   seven of its entries are live. What `busy` still means is that **at most one is non-null at a
   time**, so the registry holds at most one entry from this pane and its documented array order
   decides nothing here — which is `2d-5-2b-notes.md` §11 item 2, *recorded only*: the multi-surface
   behaviour of both predicates is driven by model tests over hand-built arrays and by no mounted case
   at all.

#### One property of `targetingSurfaceFor` a later step could make live

Its first-wins guard (`restore.ts:623`) is **behaviourally inert today**: only the `matchCreator` arm
of `OpenWriteSurface` carries a `WriteSurfaceTarget`, so a destination-less surface is always a
`matchCreator` and the variable can only ever hold that one string. The comment there claims only
what is true and was deliberately **not** rewritten to say more. **Give a second kind a
`WriteSurfaceTarget` and the guard stops being inert on its own.** `2d-5-1-C-notes.md` §3 is the
record.

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

#### Residues that are recorded, not work

None is a correctness defect in source. Named so a later step does not spend a round rediscovering them.

1. **Three 2d-4b residues — a commit message's own diff figure, a `node_modules` line citation and a
   "six review rounds" count in `workspace.test.ts:468` — are in
   [`docs/progress-archive/phase-2d.md`](docs/progress-archive/phase-2d.md).** Archived at 2d-5-2a; no
   2d-5 step reads any of them, and all three are still true.
2. **`scripts/lint/ipc-detail.test.ts` generates its cases from `scannableFiles()`**, so its count moves
   when a file is *added* under the scanned roots and no author touches it. 2d-5-2a moved it by **+2**
   without an author touching it, which is the fourth recorded instance. **Re-derive a test count per
   file, on a pristine tree, never from the total.**
3. **`docs/decisions/2d-5-2a-notes.md` §7 has seven items, six *recorded only* and one *actionable*.**
   The actionable one — that `DetailPane`'s own array and the registry answer one question and will
   disagree until 2d-5-2b routes the pane — **names no correctness defect in source**, so §7.3 does
   not hold the step open for it. It is 2d-5-2b's acceptance criterion.

## Verification baseline

**`1320 / 438 / 2253 / 186`** — `cargo test --workspace` / `npm run check` files / `npm test` /
`npm run build` modules. **Measured in full by the orchestrator alone on 2026-09-04 at Phase 2d-5-2b,
twice over** — once on the implementation and once again after the review's four fixes — with each
command run on its own. `npm run check` → **438 files, 0 errors, 0 warnings**; `npm test` → **59
files, 2253 passed**; `npm run build` → **186 modules**; `cargo test --workspace` → **1320**, summed
over **26** binaries *and* checked by the complementary question in a **second** run — **no `test
result` line lacking `0 failed`** — because a sum can be right while a binary is silent. Clippy,
`cargo fmt --check` and `cargo tree -p espansoconfig-core | rg tauri` (finds nothing) were all clean.
**Both bundle oracles were read and both lines are reported**, the second because it proves the search
can match at all: server-only markers **absent**, client-only markers **present (2)**. **The Rust half
was proven untouched and then re-run anyway** — `git diff --stat HEAD -- crates/ src-tauri/` came back
empty first, at both measurements.

**The only figure that moved is `npm test`, +18 over the whole phase, and it is derived per file on a
pristine tree rather than from the total.** Against `git archive HEAD` (`0f1ad8b`):
`DetailPane.test.ts` **8 → 23 (+15)**, `MatchCreator.test.ts` **33 → 36 (+3)**,
`scripts/lint/ipc-detail.test.ts` **132 → 132 (unmoved)**. 15 + 3 + 0 = 18, and 2235 + 18 = 2253, so
the whole move is accounted for and no other file contributed. `ipc-detail.test.ts` staying put is
**correct rather than lucky**: it generates its cases from `scannableFiles()` and moves only when a
file is *added* under the scanned roots, and this phase added none. The implementation alone was
**2251** (+16); the review's fix round added the last **+2**, both in `DetailPane.test.ts`.

**`npm run check` and `npm run build` did not move, and that is the measurement rather than the
prediction.** No file entered or left the program, and no new reachable `.ts` module and no new
`.svelte` component were added — every file this phase touched was already in the module graph — so
**186** is what an unmoved count should be, and a move would have been the regression the oracles
exist for. The two-per-styled-component rung does not apply: no `.svelte` file was added.

**Two things were verified by mutation rather than accepted as claims, and both are this phase's real
evidence.** First, **the compile-error demonstration**, re-run by the orchestrator on a key it chose
itself (`restore`, not the implementer's `matchMover`): deleting it produced **two** independent
errors — `571:9`, *"Property 'restore' is missing … but required in type 'PaneWriteSurfaces'"*, and a
second at the `satisfies` — and restoring it returned `npm run check` to 0 errors, 0 warnings. Second,
**the new assertions were shown not to be vacuous**: deleting `void surfaceGeneration` from
`openWriteSurfaces()` in `workspace.svelte.ts` failed **exactly** the two cases the review's findings
1 and 2 produced, and restoring it returned `DetailPane.test.ts` to 23 passed. A test that passes
either way would have proved nothing about the fix.

**The two coordinator files' diffs were checked mechanically, not asserted.** `git diff -U0` filtered
to non-comment changed lines returns **nothing** for `src/lib/browser/writeSurfaceRegistry.ts`, so the
registry is comment-only across the whole phase and stays framework-free; `workspace.svelte.ts` was
comment-only after the implementation and gained real code only in the fix round, which is the mirror.

**The previous baseline was `1320 / 438 / 2235 / 186`**, measured at Phase 2d-5-2a-C on 2026-09-04 and
shared by 2d-5-2a-A and -B, whose commits changed no executable line. Before it,
`1320 / 438 / 2229 / 186` at 2d-5-2a; before that, `1320 / 436 / 2205 / 185` at 2d-5-1-B, unmoved by
2d-5-1-C. In every case the orchestrator's own run is the record, never the worker's claim.


**`cargo test --workspace` in this repository is not safe to run concurrently with itself**, and 2d-5-1
is the second recorded instance. Two overlapping runs made
`watch_check::a_parked_worker_does_not_block_the_reap_of_a_worker_that_exited_behind_it` and
`watch_check::a_committed_save_is_suppressed_while_a_later_external_write_is_not` **FAIL**; both pass in
a single clean run. Real filesystem watchers are the cause. "With orphaned bin targets killed first",
already written down here, is the same hazard. **No conclusion about source may be drawn from a
concurrent run.**

**When 2d-5-7 first imports `events.ts` from production the module count moves by one, and that is the
expected step.** A larger jump is the regression the oracles exist for. 2d-5-1 did **not** import it,
by design.

### Where the closed rounds' verification narratives went

Round 13's block and the four before it (rounds 9-12), and Phase M2's, are in
[`docs/progress-archive/phase-2d.md`](docs/progress-archive/phase-2d.md) under *"the verification
narratives, archived 2026-08-30"*. **No round of the 2d-4a tail moved a count and none can now** —
the tail is closed. What the live checkpoint keeps is above: the baseline, the gate commands, the two
bundle oracles and the host scar.
---

## Key paths

The full path index, with a paragraph on why each mattered to its phase, is in
[`docs/progress-archive/status-table.md`](docs/progress-archive/status-table.md) and the phase files
beside it. These are the ones the next phase needs.

| Path | Why it matters next |
|---|---|
| [`docs/decisions/2d-4-split-notes.md`](docs/decisions/2d-4-split-notes.md) | **2d-4b's whole spec is §2.** §3 says why the EN/ES JSON landed in 4a and the accessors in 4b; §4 says what neither step does. Read this before the design consult, not after |
| [`docs/reviews/phase-2d-5-design.md`](docs/reviews/phase-2d-5-design.md) · [`docs/decisions/2d-5-split-notes.md`](docs/decisions/2d-5-split-notes.md) · [`docs/decisions/2d-5-design-brief.md`](docs/decisions/2d-5-design-brief.md) | **2d-5's binding rulings, its record and the brief that produced them.** Read the consult first, then the record's §5 corrections — the consult overrides `phase-2d-design.md` step 5 in two places. §6 carries seven unsettled items, §7 the inherited drain-guard counts |
| [`docs/reviews/phase-2d-5-2a.md`](docs/reviews/phase-2d-5-2a.md) · [`docs/decisions/2d-5-2a-notes.md`](docs/decisions/2d-5-2a-notes.md) | **What 2d-5-2a-A fixes and re-reviews.** The review's three SHOULD-FIX findings are transcribed in full under *Next action*; the notes' §3.5 and §7 item 4 are where finding 1's overclaim is repeated, and §7's seven marked items are what §7.3 was applied to |
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
| **2d-5-2b — the registry made live: the `DetailPane` assembly, seven registrations, the creator's report, the deleted producer, and the review's four fixes including the `BrowserState` reactive mirror; review 1 `ship-with-fixes`, 0 blockers, 4 SHOULD-FIX **all fixed in this commit**; 2d-5-2b-A OWED** | **`505caf6`** | ✅ pushed to `origin/main` |

**What commissioned each round of this tail, and what ended it.** `1ff4f34`'s source half — three
comment corrections in two files — commissioned **2d-5-1-B**, which found all three true. `1d623dc`'s
source half — one comment in `restore.ts` — commissioned **2d-5-1-C**, which found nothing. Under
`CLAUDE.md` §7.1 the unit is the file and a comment-only change to a source file counts, so each round
was owed however small the diff.

**2d-5-1-C's commit changes no source file at all** — `docs/reviews/phase-2d-5-1-C.md`,
`docs/decisions/2d-5-1-C-notes.md` and this file, every one of them on §7's closed list — **so it
commissions nothing, and that is what ends the tail.** Four phases, 2d-5-1 → A → B → C: three fixes
bought a round each and the fourth bought nothing. Nobody decided that, and nobody had to.

**Three commits in this project’s history have ended a review tail by changing no source file** —
`811d180` (2d-4a-H, round 13), `21cbef8` (2d-4b-H, round 8) and `61aaaba` (2d-5-1-C). The archived
section above carries the full argument for the first two, and it is the same argument. **The count
said "Two" while listing three for one commit**, which is this file's own recurring defect: a figure
that outlives what it was derived from. It is corrected here rather than left standing because its
subject is unimportant.

**What this chain commissioned, round by round.** Each of the first three fix rounds changed a source
file — `src/lib/browser/writeSurfaceRegistry.ts`, its test file, `src/lib/browser/workspace.svelte.ts`
— so under `CLAUDE.md` §7.1 each owed a round. Round 1's three findings were applied by **2d-5-2a-A**,
which took the round they commissioned. Round 2's three were applied by **2d-5-2a-B**, which took its
own. Round 3's three — including `writeSurfaceRegistry.ts:555-568`'s unscoped sentence, the chain's
**last** source change — were applied by **2d-5-2a-C**, which took its own. Round 4's two were
**record-only**, so the chain stopped there. §7.4 is why each was a phase rather than another round
inside one: the autoclaude workflow caps a phase at its own review budget, that cap outranks §7, and
**the debt it leaves is carried as a corrective phase, never written off** — which is precisely what
kept every one of these source fixes reviewed.

**The tail ended at 2d-5-2a-C, exactly as 2d-5-1's did.** Round 4 returned two SHOULD-FIX findings and
**both were record-only**, so the fix answering them changed no source file, so §7.1 commissioned
nothing and §7.2 closed the step. **Four commits in this project's history have now ended a review
tail by a fix that changed no source file** — `811d180` (2d-4a-H), `21cbef8` (2d-4b-H), `61aaaba`
(2d-5-1-C) and 2d-5-2a-C's, below. Nobody decided any of them, and nobody had to.

**The prediction recorded here before round 4 ran was wrong, and it is left standing rather than
quietly deleted.** This section said the chain was *"not near a tail ending"* and that round 3's
finding 2 *"guarantees the next fix touches source"*. It did not: 2d-5-2a-C's fix round was prose
only. The guarantee was about the **phase's** diff, which did change source, and the rule reads the
**fix round's** diff — two different things, and conflating them is what produced a confident wrong
call. **§7.1's input is the diff of the fix answering a round, never the diff of the phase.**

**The `BLOCKED` warning this section carried also fired in letter and not in effect**, and the ruling
is recorded under *"The fourth-generation instance"* above rather than here: a fourth instance of the
chain's recurring defect **did** appear, in a record rather than in source, and §7.3 reserves blocking
for a correctness defect in a **source** file. The chain converged. **The escape hatch is still
`BLOCKED` under §7.2 and is still never a shortened round** — it simply was not reached.

**What 2d-5-2b commissions, and why it is not the same shape as the chain above.** Its one review
returned four SHOULD-FIX findings and **all four were fixed in the phase's own commit**, so the input
§7.1 reads — *the diff of the fix answering the round* — is a diff that **changed source**:
`src/lib/browser/workspace.svelte.ts` substantively (the reactive mirror), plus comments in
`writeSurfaceRegistry.ts`, `DetailPane.svelte` and `MatchCreator.svelte`, plus two test files. Every
one of those is source under §7's closed-list reading. **So a round is owed and it is 2d-5-2b-A's.**

**This is the paragraph above's lesson applied rather than restated.** 2d-5-2a-C's record predicted a
tail's continuation from the *phase's* diff and was wrong; the input is the *fix round's* diff. Here
the two happen to coincide — the fixes landed in the phase commit — and that coincidence is worth
naming, because it is exactly the shape that makes the two easy to conflate again. What commissions
2d-5-2b-A is the **fix**, not the phase.
