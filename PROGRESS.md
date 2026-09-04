# PROGRESS — espansoConfig

**This file is the authoritative project state, and it is the live head only.** The conversation is
not project state: a fresh session must be able to resume from this file alone, with no conversation
history.

**Its size budget is 400 lines / 64 KiB soft and 800 / 128 KiB hard**, and a session resuming onto a
file over the hard bound archives first, before anything else. It carries the phase table, the
standing rules, the open risks, the next action, the verification baseline, the key paths and the git
head. Everything a closed phase left behind — its narrative, its verification sections, its review
dispositions and every superseded handoff — is in the archive, and **a phase closing is what
triggers the move**. **Phase 2d-5-1-B took that instruction and discharged it**: the 37 closed git-state
rows of the 2d-4a and 2d-4b chains, and the prose arguing them, are now one summary row plus a pointer
into [`docs/progress-archive/status-table.md`](docs/progress-archive/status-table.md). **The figures below are
re-measured on the file that carries them**, because a header quoting the size of the file
it replaced has already had to be corrected twice, and 2d-4b-D found the identical shape in a notes
section's line citations. **That failure recurred at the 2d-5 consult in a new place**: a citation
column derived from `docs/reviews/phase-2d-5-design.md` was left behind by two later edits to that
file's header, and only a reviewer re-deriving it noticed. A derived figure outlives the thing it was
derived from unless something re-derives it.

**Where the headroom stands, measured after the move rather than predicted before it:**
**447 lines and 58,943 bytes** — 6.4 KiB under the 64 KiB soft bound, still past the 400-line one. 2d-4b-H
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
| **2d-5** | The browser coordinator and the open-write-surface registry — seven steps, of which two touch components | 🔶 in progress — **step 1 of 7 is complete**, and its corrective tail is at 2d-5-1-B |
| **2d-5-1** | The surface and conflict vocabulary — the widened `OpenWriteSurface` union, the two predicates, `ConflictSource`, the memos, the EN/ES origin lines | ✅ complete (2026-09-04), risk **high**, worker **opus**. Review `ship-with-fixes`, **0 blockers**, 4 SHOULD-FIX — two fixed in the record, two carried to **2d-5-1-A** because they name source files and this phase's one review invocation was spent (`CLAUDE.md` §7.4). Notes `docs/decisions/2d-5-1-notes.md`; review `docs/reviews/phase-2d-5-1.md` |
| **2d-5-1-A** | 2d-5-1's corrective phase — the two source findings its review left unreviewed | ✅ complete (2026-09-04), risk **routine**, worker **opus**. Both fixed: the `coordinator()` recorder now models production (`closedByReplacementOf`), and `targetingSurfaceFor` prefers an exact document match. Review `ship-with-fixes`, **0 blockers**, 3 SHOULD-FIX — **all three false claims in a comment**, all three fixed. Notes `docs/decisions/2d-5-1-A-notes.md`; review `docs/reviews/phase-2d-5-1-A.md` |
| **2d-5-1-B** | 2d-5-1-A's corrective phase — the round its three comment corrections commissioned | 🔶 **the next action**; scoped to that fix and nothing else |
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

**Closed risks**, kept as index entries only:

| # | What it was | Closed by |
|---|---|---|
| R3 | Block-scalar and block-collection end offsets overshoot into trailing trivia | 0b (scalars) and 0c-3a (**D2n**) — the published collection span stays child-derived, cross-checked by `CollectionExtent::owned_end()` over both corpora |
| R4 | The Phase 0 architectural gate was not yet cleared | 0c-3b-2b — **PASSED**, with four qualifications; the verdict is `docs/decisions/0c-3b-2b-notes.md` §8 |
| R6 | Flow-collection comment ownership was undefined | 0b-2 (**D2d**) — the comment attaches to the innermost enclosing flow collection, which is then refused outright |
| R7 | Empty and implicit nodes create zero-width or shared boundaries with no unique owner | 0b-2 (**D2d**) — one documented, tested policy each |
| R8 | Merge keys and aliases can defeat a path resolver | 0b-2's fix round — both classified syntactically, never positionally |
| R14 | A Markdown table inside `replace: \|` rejected the whole document | 0c-1 — the backwards header lexer runs first and the forward R5 path is the fallback |
| R17 | A flow collection was not refused by the hazard gate | 0c-2b (**D2k**) — closed by guaranteeing flow-legal bytes rather than by refusing flow interiors |
| R19 | `TriviaIndex::scan` was quadratic | 0c-3b-2b's fix round — largely closed by memoisation rather than by thinning any sweep |
| R20 | A quoted scalar's reported end overshot trailing spaces and a following comment | 0c-2b — `SyntaxIndex::quoted_span()` trims back to the closing delimiter, in the span layer |
| R21 | A removal envelope was a contiguous hull, so it could not keep a file-owned comment inside it | 0c-3b-1 (**D2o**) — the envelope is an ordered, disjoint set of runs |
| R24 | A safety property that lived only in the test suite | 0c-3b-2a's fix round (**D2q**) — the check is a production property of `verify()` |

---

## Next action

### Phase 2d-5-1-A is COMPLETE. The next action is **Phase 2d-5-1-B** — the round its three comment
### corrections commissioned, and nothing else.

#### What 2d-5-1-B is

**A review of one fix round, scoped to three comment corrections in two source files.** 2d-5-1-A's
review returned three should-fix findings, all of them a **false claim in a comment** — this project's
named worst defect class — and the orchestrator fixed all three inline after re-deriving each:

1. `src/lib/browser/restore.test.ts`, the `closedByReplacementOf` doc — it claimed *"the mounted
   `DetailPane.test.ts` suite is what holds production to its own behaviour"*. **False**:
   `rg 'invalidate|creating' src/lib/components/DetailPane.test.ts` matches nothing, so
   `invalidateEverySurface` is reached by no test and the rule is unpinned on **both** sides. Corrected
   to say exactly that, here and in `2d-5-1-A-notes.md` §2.5.
2. `src/lib/browser/restore.ts`, `targetingSurfaceFor`'s doc — *"otherwise the first destination-less
   creator the list holds"* dropped the `creatorEligible` gate and so described an answer the function
   does not give. Corrected.
3. The same doc's *"the six named kinds"* — `OpenWriteSurfaceKind` has **seven** members
   (`restore.ts:340-354`); six is `CompetingWriteSurfaceKind`'s count (`:356-363`), and it excludes the
   `restore` kind this predicate deliberately counts. Corrected.

**Why a whole phase for three comments.** `CLAUDE.md` §7.1: a fix round that changed at least one
source file is owed a round, **the unit is the file and not the line**, and a comment-only change to a
source file counts — deliberately, so nobody argues about which comment was load-bearing, and several
of this project's contracts live in comments. 2d-5-1-A's one review invocation was already spent, and
§7.4 says a source fix a cap leaves unreviewed is carried by a corrective phase rather than shipped
under a phase called complete.

**Acceptance for 2d-5-1-B:** its review taken and dispositioned; any fix it prompts made; the four
gates re-measured. **If its fix round changes no source file, §7.1 commissions nothing and the tail
ends there by rule** — the shape `CLAUDE.md` §7.2 describes, which this project has closed three tails
with. Expect that: the diff under review is three comment corrections that were each re-derived before
being written.

#### One actionable item 2d-5-2 inherits, and it is not a blocker

**`invalidateEverySurface` (`src/lib/components/DetailPane.svelte:545-563`) is reached by no test.**
Deleting `creating = false` from it breaks nothing in the suite. It is a **coverage gap and not a
correctness defect** — the function is correct as written and was read against the model at 2d-5-1-A —
so `CLAUDE.md` §7.3 does not hold a step open for it. **2d-5-2 is where it belongs**, because that step
already owns `DetailPane` and already owes it mounted evidence. `2d-5-1-A-notes.md` §5 item 1 is the
record.

#### What 2d-5-1 and 2d-5-1-A shipped, so 2d-5-2 does not re-derive it

`src/lib/browser/restore.ts` holds the widened single `OpenWriteSurface` union (the consult's
declaration, with `WriteSurfaceTarget` and `WriteSurfaceDocumentTarget` named), `competingSurfaceFor`
switching on the target discriminant with a `never` terminus — **still answering `null` for an unknown
creator, which is 2c-5's shipped and window-read behaviour, and untouched by the corrective phase** —
`targetingSurfaceFor` (which prefers an exact document match and falls back to the first eligible
destination-less creator), and `creatorEligibilityOf`, which **delegates** to `destinationEligibility`
in `./matchCreation.ts` rather than restating its five conditions, so the two cannot drift.
`src/lib/browser/conflictSource.ts` is new and holds `ExternalConflictObservation`, the discriminated
`ConflictSource`, two `WeakMap` memos giving one wire value one stable source object, and the
origin-line vocabulary; two keys per language and `tConflictOriginMessage` in `src/lib/i18n/index.ts`
are its user-facing half. `conflictChoicesFor` and `adoptDiskVersion` were not touched and are still
the only choice-list producer and the only confirmed-install door.

**The split's §6-item-1 question is settled: the mechanical edit was taken.** `openWriteSurfaces()` in
`DetailPane.svelte` pushes `{ kind, target: { kind: 'document', document } }` for its six literals, so
2d-5-1 deviated from the consult's *"components: none"*. **No window reading was taken, and the ground
is narrower than it first looked**: that function has exactly one caller, `:966`, inside the
`{:else if restoring !== null}` arm at `:947` of the chain beginning at `:844`, so **five of the six
literals cannot execute at all** — in production or in any test. 2d-5-2's narrow window regression
reading is the first reading of the new shape and inherits those five.

#### The rest of the split, so a step is not invented

**2d-5-2** the exhaustive live-registry composition (components: **yes**, plus a narrow window
regression reading); **2d-5-3** the drain lifecycle coordinator; **2d-5-4** the observation state
transitions; **2d-5-5** external conflicts and save arbitration; **2d-5-6** the file-wide route-guard
closure; **2d-5-7** production activation, the capability widening and the baseline re-measure
(components: **yes**, `AppShell.svelte` only).

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

1. **`07744ae`'s commit message states its source diff as `+9 / -8` when `--numstat` gives `11 10`.**
   Permanent — this project does not rewrite pushed history. `2d-4b-notes.md` §14.4 is the correction.
2. **`2d-4b-notes.md` §11.8 claim 3 cites `node_modules/@tauri-apps/api/core.js:202`** — version-pinned,
   untracked, invisible to every gate. Correct today; a dependency bump falsifies it silently.
3. **`workspace.test.ts:468` says "six review rounds"** where three carried the cross-file ranges the
   sentence justifies. Two rounds were told they could take it and **both deliberately left it**.
4. **`scripts/lint/ipc-detail.test.ts` generates its cases from `scannableFiles()`**, so its count moves
   when a file is *added* under the scanned roots and no author touches it. 2d-5-1's own record got its
   +27 breakdown wrong by inferring per-file figures from a total that summed correctly
   (`2d-5-1-notes.md` §5). **Re-derive a test count per file, on a pristine tree, never from the total.**

## Verification baseline

**`1320 / 436 / 2205 / 185`** — `cargo test --workspace` / `npm run check` files / `npm test` /
`npm run build` modules. **Re-measured by the orchestrator alone on 2026-09-04**, each command unpiped,
first on the tree Phase 2d-5-1 produced (`1320 / 436 / 2202 / 185`) and again on 2d-5-1-A's, after the
worker had reported its own figures each time — the orchestrator's run is the record, not the worker's
claim. 2d-5-1-A moved `npm test` by **+3**, all three in `restore.test.ts` (218 → 221), and moved
nothing else: it added no file, so `npm run check` and `npm run build` are unchanged, and
`scripts/lint/ipc-detail.test.ts` stayed at 130 because its generated cases move only when a file is
added under the scanned roots. `npm run check` reported **0 errors and 0
warnings**; `npm test` reported **58 files, 2202 passed**; the Rust figure is the sum of **26**
binaries' `test result: ok` lines, all `0 failed`. `cargo clippy --workspace --all-targets -- -D
warnings`, `cargo fmt --check` and the architecture check `cargo tree -p espansoconfig-core | rg tauri`
(finds nothing) were all run and all clean.

**Both bundle oracles were read, and both lines are reported**, because the second exists to prove the
search can match at all (`CLAUDE.md` §4): server-only markers **absent**, client-only markers
**present with 2 matches**.

**Every one of the four moves is the ladder's prediction rather than a result to wave through.**
`cargo test` did not move because no Rust changed and `git status` shows nothing under `crates/` or
`src-tauri/`. `npm run check` moved **+2** for two new files entering the program. `npm test` moved
**+27**, which is **13** new cases in `restore.test.ts` (205 → 218), **12** in `conflictSource.test.ts`
and **2** in `scripts/lint/ipc-detail.test.ts`, whose `it.each(scannableFiles())` enrolled the two new
files by itself. `npm run build` moved **+1** for one new reachable `.ts` module — `conflictSource.ts`
becomes reachable because `src/lib/i18n/index.ts` imports its key builder, which is how every browser
model's key builder becomes reachable here. No `.svelte` file was added, so the two-per-styled-component
rung does not apply.

**`cargo test --workspace` in this repository is not safe to run concurrently with itself**, and 2d-5-1
is the second recorded instance. Two overlapping runs made
`watch_check::a_parked_worker_does_not_block_the_reap_of_a_worker_that_exited_behind_it` and
`watch_check::a_committed_save_is_suppressed_while_a_later_external_write_is_not` **FAIL**; both pass in
a single clean run. Real filesystem watchers are the cause. "With orphaned bin targets killed first",
already written down here, is the same hazard. **No conclusion about source may be drawn from a
concurrent run.**

**The previous baseline was `1320 / 434 / 2175 / 184`**, re-measured at the 2d-5 design consult on
2026-08-31 and unmoved through the whole eight-round 2d-4b tail. `npm run check`'s file count moved by
**three** at 2d-4b for two new files, the third being `@tauri-apps/api/event.d.ts` newly entering the
program, of which `src/lib/ipc/events.ts` is the only importer.

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
[`docs/progress-archive/status-table.md`](docs/progress-archive/status-table.md) under *"The
git-state rows of the closed 2d-4a and 2d-4b chains"*; older still is
[`docs/progress-archive/next-action-history.md`](docs/progress-archive/next-action-history.md), and
all of it is in `git log`._

| Phase | Commit | Push |
|---|---|---|
| _2d-4a through 2d-4a-H, and 2d-4b through 2d-4b-H — **both chains closed**, 37 rows_ | `eced554` … `998e346` | ✅ all pushed; **archived 2026-09-04** |
| **2d-5 design consult (brief, Codex consult, record, review — four new files, all under `docs/`, no source touched)** | **`5787e87`** | ✅ pushed to `origin/main` |
| 2d-5 design consult — the SHA and push record | `32ffcfc` | ✅ pushed to `origin/main` |
| **2d-5-1 — the surface and conflict vocabulary; review `ship-with-fixes`, 2 of 4 findings carried to 2d-5-1-A** | **`16a122b`** | ✅ pushed to `origin/main` |
| 2d-5-1 — the SHA and push record | `ae15127` | ✅ pushed to `origin/main` |
| **2d-5-1-A — the two source fixes, plus the three comment corrections its review found; 2d-5-1-B OWED** | **`1ff4f34`** | ✅ pushed to `origin/main` |

**What commissions 2d-5-1-B is the source half of `1ff4f34`, and it is three comment corrections in
two files** — `src/lib/browser/restore.ts` and `src/lib/browser/restore.test.ts`. Under `CLAUDE.md`
§7.1 the unit is the file and a comment-only change to a source file counts, so the round is owed
however small the diff. The other three files that commit touches — `PROGRESS.md`,
`docs/decisions/2d-5-1-A-notes.md` and `docs/reviews/phase-2d-5-1-A.md` — are all on §7's closed
list and commission nothing.

**Two commits in this project’s history have ended a review tail by changing no source file** —
`811d180` (2d-4a-H, round 13) and `21cbef8` (2d-4b-H, round 8). That is the shape 2d-5-1-B expects
to reach, and the archived section above carries the full argument for why nobody had to decide it.
