# PROGRESS — espansoConfig

**This file is the authoritative project state, and it is the live head only.** The conversation is
not project state: a fresh session must be able to resume from this file alone, with no conversation
history.

**Its size budget is 400 lines / 64 KiB soft and 800 / 128 KiB hard**, and a session resuming onto a
file over the hard bound archives first, before anything else. It carries the phase table, the
standing rules, the open risks, the next action, the verification baseline, the key paths and the git
head. Everything a closed phase left behind — its narrative, its verification sections, its review
dispositions and every superseded handoff — is in the archive, and **a phase closing is what
triggers the move**. As of 2d-4b-F it is **451 lines and 59,921 bytes** — **and the figures are
re-measured on the file that carries them**, because a header quoting the size of the file it replaced
has already had to be corrected twice, and 2d-4b-D found the identical shape in a notes section's line
citations. This session ran five phases and rewrote *Next action* in place each time. **2d-4b-E is
where the headroom came back**: it had fallen to 727 bytes, and twelve Phase 0 substrate rows went to
`phase-0.md` under a pointer, exactly as 2d-4a's five closed corrective rows went to `status-table.md`
before them. **The next places to look for length are the *Next action*'s narrative half and the five
superseded 2d-4b chain rows in the phase table**, whose full detail is already in
`docs/decisions/2d-4b-notes.md` §8–§12. **Nothing of the 2d-4b chain is archivable yet**: 2d-4b, B, C,
D, E and F are all superseded rather than closed, and the chain's live head is 2d-4b-G.

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
| **2d-4b** | The TypeScript half of the wire — the mirror, the drain wrapper, the injectable event source, the i18n accessors, and the deletion of `AWAITING_FRONTEND_DECLARATION` | 🔶 **ran in full, every gate green, NOT closed** — one review round, `ship-with-fixes`, **0 blockers**, 4 should-fix, **all four fixed**, and the fix found **four narrower instances** of the same shape. **Its fix round changed source, so §7.1 commissions a round; superseded by 2d-4b-B** |
| **2d-4b-B** | First corrective phase: the review of 2d-4b's fix round, scoped to eight files across `codes.{ts,test.ts}`, `events.{ts,test.ts}`, three suites and `wire_contract.rs` | 🔶 **ran in full, every gate green, NOT closed** — `ship-with-fixes`, **0 High**, 1 Medium + 2 Low, **all three fixed**. The Medium is an assertion claiming more than it measures: the drain counter sees only the **injected** surface, and `workspace.svelte.ts`'s module-level import is a route around it — measured at **186 passed, 0 failed**. It also **re-derived and confirmed** the three claims the brief put to it (the 49 builders, the `wire_contract.rs:3724` doc, the `ExpectNever` widening guard). **Its fix changed three source files, so §7.1 commissions a round; superseded by 2d-4b-C** |
| **2d-4b-C** | Second corrective phase: the review of 2d-4b-B's fix — six bounded comments in three test suites | 🔶 **ran in full, every gate green, NOT closed** — `ship-with-fixes`, **0 High**, 2 Medium + 2 Low, **all four fixed**. Both Mediums are the previous fix's own residue: **the doc comment it skipped** still carried the unbounded claim, in the one file whose subject module is the escaping route, and both component suites named that route *absent* while mounting a real `BrowserState` that holds it. The miscount that hid the first is the round's L2 — *"all six sentences"* against a diff of eight blocks. **Its fix changed the same three source files, so §7.1 commissions a round; superseded by 2d-4b-D** |
| **2d-4b-D** | Third corrective phase: the review of 2d-4b-C's fix — four corrected comment blocks in the same three suites | 🔶 **ran in full, every gate green, NOT closed** — `ship-with-fixes`, **0 High**, 1 Medium + 2 Low, **all three fixed**. It **verified the diff's extent before reading any claim about it** (4 hunks, every changed line a comment), which is what §9.8 asked of it, and confirmed no unbounded sentence survives anywhere. The Medium is a comment true of its conclusion and false about its reason — *"unlike the two component suites, which reject at `invoke`"*, when all three suites reject and only two **record**. **Its fix changed one source file, so §7.1 commissions a round; superseded by 2d-4b-E** |
| **2d-4b-E** | Fourth corrective phase: the review of 2d-4b-D's fix — one comment block in `workspace.test.ts` | 🔶 **ran in full, every gate green, NOT closed** — `ship-with-fixes`, **0 High**, 1 Medium + 1 Low, **both fixed**, both in that one block. The Medium is §8.2's shape returning: the `invoked` spy named as the asymmetry **without its limit**, when both component suites say in their own comments that it is a *partial trap* — asserted 1 + 5 times case by case, **never** in either `afterEach`, which read the injected count instead. So **no file traps the binding route file-wide** and 2d-5 owes a closure to three files, not one. The Low is §10.1's shape returning: under node `window` is undeclared, so the real `invoke` throws `ReferenceError` evaluating the **identifier** — a *dereference* is jsdom's mechanism, which that sentence's own premise excludes. **Its fix changed one source file, so §7.1 commissions a round; superseded by 2d-4b-F** |
| **2d-4b-F** | Fifth corrective phase: the review of 2d-4b-E's fix — the same one comment block in `workspace.test.ts` | 🔶 **ran in full, every gate green, NOT closed** — `ship-with-fixes`, **0 High, 0 Medium**, 2 should-fix, both applied. **The first round of this chain to find no defect in the reviewed sentences**: it re-derived every clause independently — the `core.js:202` citation, the environment, the 1 + 5 spy assertions across six `it` blocks, both `afterEach` blocks, the 16/13/3/2 split, a live 186 — and reported all correct. Its two findings are of a different kind: an off-by-one in §11.7 item 6's own figure (the stub is 8 lines, not 9 — `:497` closes the object literal), and a **restructure**. Nothing in this repository checks a comment, so the paragraph's four cross-file line ranges could be silently falsified by an edit to either component suite; the detail moved to `2d-4b-notes.md` §11.8 and the run went **43 lines → 24**, citing no line number anywhere. **Its fix changed one source file, so §7.1 commissions a round; superseded by 2d-4b-G** |
| **2d-4b-G** | Sixth corrective phase: the review of 2d-4b-F's restructure — an 8-line comment and the pointer it now leans on | ⬜️ **not started — this is the next action** |
| **2d-5 … 2d-8** | The remaining four steps of the consult's eight | ⬜️ not started |
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

### Phase 2d-4b-F RAN IN FULL and is **NOT closed**. The next action is **Phase 2d-4b-G** — the review
### of 2d-4b-F's fix, commissioned by §7.1 because that fix changed one source file.

The 2d-4b chain now runs 2d-4b → B → C → D → E → F → **G**, each phase the review of its predecessor's
fix, each superseded by its successor and **none of them closed**. The records are
[`docs/decisions/2d-4b-notes.md`](docs/decisions/2d-4b-notes.md) §8 (B), §9 (C), §10 (D), §11 (E) and
**§12 (F)**; the reports are `docs/reviews/phase-2d-4b-{B,C,D,E,F}.md`.

**Round F changed the chain's subject rather than its sentences, and that is what a session resuming
here needs to know first.** Rounds 2-5 each found a real defect in one long comment, and round 5 found
two *repeats* of shapes already on file. Round F found **none** — it re-derived every clause of that
comment independently and reported all correct — and instead asked where the paragraph should live.
Its reason is structural: four of its sentences were cross-file line ranges, **nothing in this
repository checks a comment**, and an edit to either component suite would silently falsify them.
So the measurements moved into `2d-4b-notes.md` **§11.8**, which exists to be what the comment now
points at, and the run went **43 lines → 24**, citing no line number in any file. §12.1 is the reasoning.

**That fix changed source, so §7.1 commissions round G exactly as before — the rule reads the diff,
never the intent.** Removing the tail's fuel is not the same as ending the tail, and §7.2 forbids
forcing it. What changed is the next round's odds.

#### What round 2d-4b-G is scoped to

`git show 54ef596 -- src/` — **one hunk expected**, the shortened comment above the
`scriptedCommands()` drain stub in `src/lib/browser/workspace.test.ts`. **Count the hunks before
reading any sentence about how many there are**; that instruction has caught defects in three rounds.

Two things are worth the round's budget, and they are new:

1. **Does the pointer find what it claims?** The comment defers its measurements to
   `docs/decisions/2d-4b-notes.md` §11.8. §11.8 must carry all four claims the comment stopped
   carrying — the 16/13/3/2 wrapper split, the two phases' two routes (254 injected / 186 binding),
   why a drain is swallowed rather than recorded in this file, and the partial trap with its 1 + 5
   counts and both `afterEach` blocks. **A pointer to a section that does not hold what it promises is
   this project's worst defect class**, so check the target, not only the reference.
2. **Is the shortened comment wider than its predicate?** It now claims that no suite in this
   repository closes the binding route file-wide, this one included. That is the one substantive claim
   it kept, and *a claim wider than its predicate* is the shape this chain has produced three times.

**Do not re-file what §12.5 records**, six items. Item 1 is *actionable* and explicitly **not** a
correctness defect in source, so the step closes without it. Item 2 is new and is what the restructure
cost: **the pointer is load-bearing and nothing checks it** — one reference that breaks when somebody
edits this notes file, traded for four that broke when somebody edited two other suites.

#### After the chain closes

**2d-5** — the open-surface registry and the reconciliation coordinator. Every obligation 2d-4b refused
lands there: the watermark, the epoch comparison, `discarded` handling, all four drain-firing orders,
disposal racing registration, and the capability widening (**both** `core:event:allow-listen` and
`core:event:allow-unlisten`) with a re-run of `dispatch_check.rs`. It also inherits **§9.5 as sharpened
by §10.1 and again by §11.1**: the drain guard's escaping route is stated, not closed, and **no suite
traps it file-wide** — the two with a spy catch it in six named cases and nowhere else, so the closure
is owed to all three files rather than to the one without a spy.
`docs/reviews/phase-2d-design.md` Q8 names an incomplete registry as this whole phase's sharpest failure
mode, and by the standing rule since 2b-2c **2d-5 opens with its own design consult**.

## Verification baseline

**`1320 / 434 / 2175 / 184`** — `cargo test --workspace` / `npm run check` files / `npm test` /
`npm run build` modules. **All four re-measured by the orchestrator alone on 2026-08-31**, each
command unpiped, on the tree Phase 2d-4b-F's fix produced, with orphaned bin targets killed first —
and re-measured on 2d-4b-B's, 2d-4b-C's, 2d-4b-D's and 2d-4b-E's before that, making **five** full runs
of every gate in one session. The Rust figure is the sum of 26 binaries' `test result: ok` lines,
0 failed. **No figure has moved since 2d-4b**, which is the prediction: all five corrective phases
changed comment text in test files plus the record, and no test case, no production module and no Rust
line. **2d-4b-F is the first of them to delete more than it wrote** — its source diff is `+15 / −34`,
still every line a comment — and no count moved for that either, which is the same prediction from the
other direction. The baseline before 2d-4b was `1313 / 431 / 2125 / 184`.

**The module count did not move at 2d-4b either, and that is the ladder's prediction rather than a
suspicious result.** `CLAUDE.md` §4 costs one module per **reachable** new source module, and
`src/lib/ipc/events.ts` is not reachable from the application entry — no non-test file under `src/`
imports it, because 2d-4b deliberately registers no listener. **Both bundle oracles are read every
time regardless**, and were at 2d-4b-B: server-only markers absent, client-only markers present with 2
matches. The `npm run check` file count moved by **three** at 2d-4b for two new files, the third being
`@tauri-apps/api/event.d.ts` newly entering the program, of which `events.ts` is the only importer.

**When 2d-5 first imports `events.ts` the module count moves by one, and that is the expected step.**
A larger jump is the regression the oracles exist for.

```sh
cargo build --workspace
cargo test --workspace
cargo clippy --workspace --all-targets -- -D warnings   # clean
cargo fmt --check                                       # clean
cargo doc --workspace --no-deps                         # exit 0; 73 private_intra_doc_links, 0 unresolved
cargo tree -p espansoconfig-core | rg tauri             # must find NOTHING

npm run check    # svelte-check, --fail-on-warnings
npm test         # vitest
npm run build    # vite
```

**The module count alone decides nothing, and searching the bundle for `svelte/internal/server` is
vacuous** — Vite minifies specifiers away, so that string is absent either way. Use the oracle that
discriminates and read **both** lines; the second exists to prove the search can match at all:

```sh
rg -c '\$\$payload|head_payload|push_element' dist/assets/index-*.js   # server-only — must be ABSENT
rg -c 'window\.__svelte|svelte-trusted-html' dist/assets/index-*.js    # client-only — must be PRESENT
```

**⚠️ The host scar.** An orphaned bin target left by a killed run produces nine or ten `watch_check::`
baseline-scan timeouts that look exactly like a real failure. Kill orphans with
`pkill -f 'target/debug/deps/espansoconfig-'`, run the workspace suite **once**, and stay off the
machine; the single-threaded gate is
`cargo test -p espansoconfig --bin espansoconfig watch_check:: -- --test-threads=1` (20/20).
**Do not pipe a gate whose exit status you intend to trust** — `cargo test --workspace 2>&1 | tail -40`
reports `tail`'s status, and it hid ten failures once.

`npm install` (or `npm ci`) is required before any frontend command will run.

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
| [`docs/reviews/phase-2d-design.md`](docs/reviews/phase-2d-design.md) | The consult that shaped Phase 2d into eight steps, and Q8's sharpest green-suite failure. **2d-4b's own consult is now taken** and is the row below |
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

_Updated at each phase boundary. Only the most recent rows are kept here; the full table is in the
archive under [`docs/progress-archive/next-action-history.md`](docs/progress-archive/next-action-history.md)
and in `git log`._

| Phase | Commit | Push |
|---|---|---|
| 2d-4a (round 5 + its fix, NOT closed) | `eced554` | ✅ pushed to `origin/main` |
| 2d-4a-C step 1 (round 3 + its fix, NOT closed) | `4ab5e2e` | ✅ pushed to `origin/main` |
| 2d-4a-C step 1 (round 4 — READY; the step CLOSES here) | `57e8800` | ✅ pushed to `origin/main` |
| 2d-4a-C step 2 (the check; implemented and green, review OWED) | `65a0138` | ✅ pushed to `origin/main` |
| 2d-4a-C step 2 (round 1 + its fix) | `bca13e2` | ✅ pushed to `origin/main` |
| 2d-4a-C step 2 (round 2 + its fix) | `e75ec2b` | ✅ pushed to `origin/main` |
| 2d-4a-C step 2 (round 3 + its fix) | `2bd7bd5` | ✅ pushed to `origin/main` |
| 2d-4a-C step 2 (round 4 + its fix) | `2695cbb` | ✅ pushed to `origin/main` |
| 2d-4a-C step 2 (round 5 + its fix) | `5593a90` | ✅ pushed to `origin/main` |
| 2d-4a-C step 2 (round 6 + its fix) | `d4bf905` | ✅ pushed to `origin/main` |
| 2d-4a-C step 2 (round 7 + its fix) | `1c5a9bb` | ✅ pushed to `origin/main` |
| 2d-4a-C step 2 (round 8 + its fix; round 9 OWED) | `2efce7a` | ✅ pushed to `origin/main` |
| 2d-4a-C step 2 (round 9 DISPATCHED AND ABORTED — no reply) | `2a39b3c` | ✅ pushed to `origin/main` |
| 2d-4a-C step 2 (round 9 ran; the phase CLOSES here) | `dced09a` | see below |
| Checkpoint split — this file cut from 21,803 lines to under 400 | `3db0ff3` | ✅ pushed to `origin/main` |
| M2 — the review-tail termination rule, after two review rounds | `93fb76b` | ✅ pushed to `origin/main` |
| 2d-4a rounds 7 and 8, both fix rounds, and the `INVENTORY` judgement the guard forced | `125dfa8` | ✅ pushed to `origin/main` |
| **2d-4a-D — round 9 and its fix; round 10 OWED** | `6572a29` | ✅ pushed to `origin/main` |
| 2d-4a-D — the SHA and push record | `d264012` | ✅ pushed to `origin/main` |
| **2d-4a-E — round 10 and its fix; round 11 OWED** | `22d1afb` | ✅ pushed to `origin/main` |
| 2d-4a-E — the SHA and push record | `f7bbf6d` | ✅ pushed to `origin/main` |
| **2d-4a-F — round 11 and its fix; round 12 OWED** | `b854de5` | ✅ pushed to `origin/main` |
| 2d-4a-F — the SHA and push record | `4d90177` | ✅ pushed to `origin/main` |
| **2d-4a-G — round 12 and its fix; round 13 OWED** | `e334d5b` | ✅ pushed to `origin/main` |

**Each of those source commits is what made the next round owed — and the chain stops here.**
`125dfa8` changed five files under `src-tauri/src/` and made round 9 owed; `6572a29` changed two and
made round 10 owed; `22d1afb` changed **one**, two comment hunks in `reconciliation.rs`, and made
round 11 owed; `b854de5` changed **one**, a single sentence of the same doc comment (+4 / −3), and
made round **12** owed; `e334d5b` changed **one**, the punctuation of that same sentence and one
deleted clause (+3 / −4), and made round **13** owed. **Every one of them is comment or inventory
prose with no executable line changed**, and under §7.1 the unit is the file, so each still
commissioned a round.

**`811d180` changed no source file at all** — seven files, every one of them `CLAUDE.md`,
`PROGRESS.md` or under `docs/` — **so it commissions nothing, and that is what ends the tail.**

| Phase | Commit | Push |
|---|---|---|
| 2d-4a-G (round 12 + its fix, NOT closed) | `e334d5b` | ✅ pushed to `origin/main` |
| **2d-4a-H (round 13 + its fix — the tail CLOSES here, and 2d-4a with it)** | **`811d180`** | ✅ pushed to `origin/main` |

| 2d-4b design consult (Codex; the checkpoint archived first) | `da15079` | ✅ pushed to `origin/main` |
| **2d-4b — the whole TypeScript half, its review and its fix; round 2 OWED** | **`be8d424`** | ✅ pushed to `origin/main` |

**`da15079` changed no source file** — five files, every one of them `PROGRESS.md` or under `docs/` —
**so the consult commissioned nothing.** The 2d-4b commit changes source in eighteen files and its
review has already run; what commissions **2d-4b-B** is not that commit but the **fix round inside
it**, which changed eight source files after the review returned. Under `/autoclaude`'s
one-review-per-phase cap there is no second invocation in this phase, so that round becomes the
corrective phase — the same shape as 2d-4a's D → E → F → G → H chain, and the case `CLAUDE.md` §7.4
describes in as many words.

| Phase | Commit | Push |
|---|---|---|
| **2d-4b-B — round 2 and its fix; round 3 OWED** | **`1c34579`** | ✅ pushed to `origin/main` |
| **2d-4b-C — round 3 and its fix; round 4 OWED** | **`e510819`** | ✅ pushed to `origin/main` |
| **2d-4b-D — round 4 and its fix; round 5 OWED** | **`6dba9f7`** | ✅ pushed to `origin/main` |
| **2d-4b-E — round 5 and its fix; round 6 OWED** | **`081ea14`** | ✅ pushed to `origin/main` |
| **2d-4b-F — round 6 and its restructure; round 7 OWED** | **`54ef596`** | ✅ pushed to `origin/main` |

**Each of the five commissions the next round**, the unit being the file, and the source half of each
is comment text with **not one executable line**: `1c34579` six blocks in three files, `e510819` four
blocks in three files, `6dba9f7` **one block in one file**, `081ea14` the **same** block again, and
2d-4b-F's commit that block **shortened from 43 lines to 24** (`+15 / −34`). Everything else they touch
is `PROGRESS.md`, `docs/decisions/2d-4b-notes.md` §8–§12, `docs/progress-archive/status-table.md`,
`docs/progress-archive/phase-0.md` and the five new review files, all on §7's closed list.

**`081ea14` also carries this session's checkpoint maintenance** — twelve Phase 0 risk rows moved to
`phase-0.md` — which is a change to two files on the closed list and commissions nothing of its own.
What commissioned **2d-4b-F** was the one comment block in `src/lib/browser/workspace.test.ts`, and
nothing else in that commit.

**2d-4b-F is the first commit of this chain whose source change is a deletion rather than a repair**,
and §7.1 commissions round G from it just the same: the rule reads the diff, never the intent.
