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
| _**2d-3** … **2d-6-11b** — the 24 status rows of the closed 2d-3 … 2d-5-2 chains, the 2d-5 design consult, 2d-5 and its steps, the 2d-6 design consult and every 2d-6 sub-step_ | see the archive | ✅ **all complete and CLOSED; 2d-5 and 2d-6 closed with them.** **Rows archived verbatim 2026-09-23 at 2d-7-8** to [`status-table.md`](docs/progress-archive/status-table.md) under *"The status rows of the closed 2d-3 … 2d-6-11b phases, as the live head held them"*; each row there names its notes, window readings and reviews. Two things a later step reads from them: a **visible-window reading** stays owed by 2d-6-9c (notes §6 item 7) and 2d-6-10 (notes §4), and 2d-4a (13 rounds), 2d-4b (8) and 2d-5-1 (4) were ended **by rule**, 2d-3 (14) and 2d-4a-C-2 (9) by a human |
| **2d-7 design consult** | 2d-7 put to a design consult before any line of it was written. Brief [`2d-7-design-brief.md`](docs/decisions/2d-7-design-brief.md) (12 questions); consult [`phase-2d-7-design.md`](docs/reviews/phase-2d-7-design.md) by a **Claude Opus agent** (Codex out of quota): keep and repair the existing uncommitted instrument, do not rebuild it, and cut 2d-7 into **ten** steps. The record [`2d-7-split-notes.md`](docs/decisions/2d-7-split-notes.md) has **36 binding rulings**, the ten-step plan with acceptance and risk classes, and the open-items map; its citation audit found 154 consult citations, 148 resolve, 6 with a note, 0 fail. It narrows the consult in §5 (e.g. the open-surface refusal is not "reached", and the recorder ordering has a gap). **No source touched** | ✅ **complete and CLOSED.** Risk **high**; workers **opus** (brief, consult, record). Review: `autoclaude-review.sh` **exited 2** (`REASON=usage-limit`), so the **fallback agent `autoclaude-reviewer` (opus)** wrote [`phase-2d-7-design-record-review.md`](docs/reviews/phase-2d-7-design-record-review.md): **`ship-with-fixes`, 0 BLOCKERS, 6 SHOULD-FIX**, all re-derived, held and fixed in the record (§8 lists each resolution) |
| _**2d-7-1**_ | The `stale` ruling and its fix | ✅ **complete and CLOSED** (Codex, `ship`, 0 BLOCKERS, 0 SHOULD-FIX; rung `1323 / 462 / 3539 / 201`). **Row archived 2026-09-23 at 2d-7-2** to [`status-table.md`](docs/progress-archive/status-table.md); notes `docs/decisions/2d-7-1-notes.md`, review `docs/reviews/phase-2d-7-1.md` |
| _**2d-7-2**_ | The presentation and comment fixes, and the ES mounted cases | ✅ **complete and CLOSED** (Codex, `ship`, 0 findings; rung `1323 / 462 / 3547 / 201`). **Row archived 2026-09-23 at 2d-7-3** to [`status-table.md`](docs/progress-archive/status-table.md); notes `docs/decisions/2d-7-2-notes.md`, review `docs/reviews/phase-2d-7-2.md`. Open items (five `tExternalEvidenceRefusal` caller comments; ambiguous `tSupersededEvidence` wording in three modules) are in the archived row and the notes |
| _**2d-7-3**_ | The instrument, Rust side (uncommitted `probe.rs`) | ✅ **complete and CLOSED** (Codex, `ship-with-fixes`, 0 BLOCKERS + 1 SHOULD-FIX, fixed; rung `1330 / 462 / 3547 / 201`). **Row archived 2026-09-23 at 2d-7-4-1** to [`status-table.md`](docs/progress-archive/status-table.md); notes `docs/decisions/2d-7-3-notes.md`, review `docs/reviews/phase-2d-7-3.md`. Page-side open items for 2d-7-4-2 are in the notes §6 |
| _**2d-7-4-1**_ | The instrument's harness and tools, the first half of 2d-7-4 | ✅ **complete and CLOSED** (Codex, `ship-with-fixes`, 1 BLOCKER + 2 SHOULD-FIX, all fixed; rung `1330 / 462 / 3547 / 201`). **Row archived 2026-09-23 at 2d-7-4-2** to [`status-table.md`](docs/progress-archive/status-table.md); notes `docs/decisions/2d-7-4-1-notes.md`, review `docs/reviews/phase-2d-7-4-1.md` |
| _**2d-7-4-2**_ | The instrument's page side, the five shakedowns and THE instrument review; 2d-7-4 closes | ✅ **complete and CLOSED** (Codex, `ship-with-fixes`, 2 BLOCKERS + 3 SHOULD-FIX; four fixed, S5 handed to 2d-7-5; rung `1330 / 462 / 3547 / 201`). **Row archived 2026-09-23 at 2d-7-5** to [`status-table.md`](docs/progress-archive/status-table.md); notes `docs/decisions/2d-7-4-2-notes.md` (§5.3 the frozen hashes), review `docs/reviews/phase-2d-7-4-2.md` |
| _**2d-7-5**_ | G1 — delivery, watcher and counters, a window reading (records only) | ✅ **complete and CLOSED** (Codex, `ship-with-fixes`, 0 BLOCKERS + 1 SHOULD-FIX, fixed in the records; rung unchanged `1330 / 462 / 3547 / 201`). **Row archived 2026-09-23 at 2d-7-6-1** to [`status-table.md`](docs/progress-archive/status-table.md); notes `docs/decisions/2d-7-5-notes.md`, the window reading `2d-7-5-window-reading.md`, review `docs/reviews/phase-2d-7-5.md` |
| _**2d-7-6-1**_ | G2 — retention, conflict timing and the locale switch, a window reading (records only) | ✅ **complete and CLOSED on the owner's ruling of 2026-09-23** (option (a); clauses 2 and 5 recorded unread and handed to 2d-7-9 / 2d-7-10; Codex, `ship-with-fixes`, 1 BLOCKER + 1 SHOULD-FIX, both fixed in the records; rung unchanged `1330 / 462 / 3547 / 201`). **Row archived 2026-09-23 at 2d-7-6-2** to [`status-table.md`](docs/progress-archive/status-table.md); notes `docs/decisions/2d-7-6-1-notes.md`, the window reading `2d-7-6-1-window-reading.md`, review `docs/reviews/phase-2d-7-6-1.md` |
| _**2d-7-6-2**_ | G3 — compare, keep, reload, recovery, copy, adoption arms and the open-surface refusal, a window reading (records only) | ✅ **complete and CLOSED on the owner's ruling of 2026-09-23** (option (a); clause 1 recorded unread and handed to 2d-7-9 / 2d-7-10; Codex, `ship-with-fixes`, 0 BLOCKERS + 1 SHOULD-FIX, fixed in the records; rung unchanged `1330 / 462 / 3547 / 201`). **Row archived 2026-09-23 at 2d-7-7** to [`status-table.md`](docs/progress-archive/status-table.md); notes `docs/decisions/2d-7-6-2-notes.md`, the window reading `2d-7-6-2-window-reading.md`, review `docs/reviews/phase-2d-7-6-2.md` |
| _**2d-7-7**_ | R38 — the fifteen byte-exact fixtures in the raw viewer and on one conflict panel, a window reading (records only) | ✅ **complete and CLOSED on the owner's standing ruling of 2026-09-23** (entry 37; the panel/refresh half recorded unread for all fifteen; Codex, `ship`, 0 findings; rung unchanged `1330 / 462 / 3547 / 201`). **Row archived 2026-09-23 at 2d-7-8** to [`status-table.md`](docs/progress-archive/status-table.md); notes `docs/decisions/2d-7-7-notes.md`, the window reading `2d-7-7-window-reading.md`, review `docs/reviews/phase-2d-7-7.md` |
| **2d-7-8** | **G4 — the reconciliation-status states 9c left unread, a window reading (records only).** 13 launches `G4-01` … `G4-13` (9 EN, 4 ES twins of `status-held`, `status-uncertain-raw`, `status-registration` and `status-stale`), each on a fresh bundle path with its language set through the picker, all reaching `--- end`, none voided; binary `53d84fb2…` in all 13; hashes 18/18 equal the frozen set before and after. **No `:keepalive`**: the screen read unlocked and every beat `visibility=visible`, and entry 18 forbids the keep-alive in a visible launch — disclosed (notes §2). **The fourteen G4 rows, each once with its class** (notes §3): **1 held** — row 12, `stale` behind a panel alone after 2d-7-1 (`G4-02` EN, `G4-10` ES); **0 reached, 0 constructed; 13 unread** — 11 for want of a frozen plan, each with the missing plan capability named and handed to 2d-7-9 / 2d-7-10 under entry 37; the 9b-1 §8.3 release path named unreachable up front (entry 23); the owner row, which is G5's (2d-7-9). The save races' `emitted=0` owed from 2d-7-6-2 read again, cause not established. S5 stands. **Components: none; no tracked source changed** | ✅ **complete and CLOSED under the owner's standing ruling of 2026-09-23** (record §3 entry 37); the acceptance, *every G4 row appears exactly once with its class*, is **met** by notes §3. Risk class **routine**; worker model **opus** (one worker); driven. Review: `autoclaude-review.sh` **exited 0 — Codex**, no fallback: **`ship`, 0 BLOCKERS, 0 SHOULD-FIX** ([`docs/reviews/phase-2d-7-8.md`](docs/reviews/phase-2d-7-8.md), brief [`phase-2d-7-8.brief.md`](docs/reviews/phase-2d-7-8.brief.md)); nothing to fix. Rung unchanged **`1330 / 462 / 3547 / 201`**. Records: [`2d-7-8-notes.md`](docs/decisions/2d-7-8-notes.md), [`2d-7-8-window-reading.md`](docs/decisions/2d-7-8-window-reading.md) |
| **2d-6 … 2d-8** | The remaining three steps of the 2d consult's eight; 2d-6 is eleven sub-steps `2d-6-1` … `2d-6-11` per its consult, 2d-6-1 cut into `1a`/`1b`/`1c`, 2d-6-6 into `6a`/`6b`/`6c`, 6c into `6c-1`/`6c-2`, 2d-6-7 into `7a`/`7b`/`7c`, 2d-6-8 into `8a`/`8b`/`8c`, 2d-6-9 into `9a`/`9b`/`9c`, 9b into `9b-1`/`9b-2`/`9b-3`, and 2d-6-11 into `11a`/`11b` | ✅ **2d-6 complete** (all eleven steps, 2026-09-23; 2d-6-11b closed it); **the 2d-7 design consult closed; 2d-7-1, 2d-7-2 and 2d-7-3 closed; 2d-7-4 cut into `4-1`/`4-2`, both closed, and 2d-7-4 with them; 2d-7-5 closed; 2d-7-6 cut into `6-1`/`6-2`; 2d-7-6-1 closed on the owner's ruling of 2026-09-23 (two clauses recorded unread); 2d-7-6-2 closed on the owner's ruling of 2026-09-23 (clause 1 recorded unread), and 2d-7-6 with it; 2d-7-7 closed on the owner's standing ruling of 2026-09-23 (record entry 37; the panel/refresh half recorded unread); 2d-7-8 closed under entry 37 (G4: one row held, thirteen unread); **2d-7-9 (owner-present) is next, and a driven run stops `BLOCKED` there (entry 21)** |
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

**Open items from 2d-7-8, for 2d-7-10** ([`2d-7-8-notes.md`](docs/decisions/2d-7-8-notes.md) §7 items 2-4; observations, not defects): (1) **`listenRefused` draws `registrationFailed.rejected`, not `noTransport`** — the app gives `noTransport` only for its own `NO_RECONCILIATION_TRANSPORT` error, so the consult's "constructed by `listenRefused`" does not hold; (2) **`unavailable` draws no retry control** (`G4-01`) — `externalConflict.action.retry` belongs to a held observation, so the consult's G4 row 1 premise may not match the code; (3) **the refused-save silence** — a foreign write followed within about 0.1 s by a save refused on those bytes emitted no observation (`emitted=0`) in `G4-07`, `-08`, `-09` and `-13`, the `status-stale` launches included; cause not established, to be classed as expected coalescing or a gap.

**Closed risks** — the full index of every risk this project has closed, with the phase and decision
that closed each, is in
[`docs/progress-archive/decisions.md`](docs/progress-archive/decisions.md) under *"The closed-risk
index"*. **It was archived at 2d-5-2a because it is pure index**: no row is work, and no later phase owes
any of them anything.

---
## Next action
### 2d-7-8 is complete and CLOSED under the owner's standing ruling. The next step is **Phase 2d-7-9: the owner-present, unlocked-screen visible session (G5) — `BLOCKED` on the owner.**

**2d-7-9 is never selected by a driven run** (record [`2d-7-split-notes.md`](docs/decisions/2d-7-split-notes.md) §3 **entry 21**). The driven run that closed 2d-7-8 stopped `BLOCKED` there and marked the row `blocked`; **that stop is the plan's own, not a gap**, and entry 37 does not remove it. Nothing more can be done by a driven run until the owner acts.

**The owner's standing ruling, 2026-09-23** (record §3 **entry 37**, quoted verbatim there and in [`2d-7-7-notes.md`](docs/decisions/2d-7-7-notes.md) §3b): "For the rest of 2d-7, any row the frozen instrument cannot read is recorded unread and hadnded to 2d-7-9 and 2d-7-10." It bound 2d-7-8, which closed on it (one G4 row held, thirteen unread, the eleven plan-less rows handed to 2d-7-9 and 2d-7-10 with their missing plan capabilities named — [`2d-7-8-notes.md`](docs/decisions/2d-7-8-notes.md) §3, §7), and **it still binds 2d-7-10.** It changes nothing else: entry 6 and the frozen hashes stand (no instrument revision is authorized), **entry 21 stands**, a row the instrument can read is still read, and a missing plan is never added silently. The superseded text is archived verbatim in [`next-action-history.md`](docs/progress-archive/next-action-history.md) under *"The 2d-7-7 → 2d-7-8 next action"*.

**What the owner must do — one of two:**
- **(a) Run 2d-7-9 in an interactive session with the owner present** — not through the `autoclaude-until-done` driver. The owner sits at the unlocked screen and grants Accessibility permission to the input tool. The session checks the frozen instrument first (`/private/tmp/2d7-6-1-hashcheck.sh`, `summary ok=18 diff=0`, against [`2d-7-4-2-notes.md`](docs/decisions/2d-7-4-2-notes.md) §5.3), launches through `launch-7.sh` under `/private/tmp/espansoconfig-harness-2d-6-6c-2/`, fresh bundle path each, language through the picker, **no `:keepalive` and no substitution** (entries 17, 18). It writes `docs/decisions/2d-7-9-notes.md` and a window reading, takes one review, and closes; then 2d-7-10 may run driven.
- **(b) Rule, in the owner's own message, that 2d-7-9's items are recorded unread**, so that **2d-7-10** (consolidation) can proceed in a driven run — record §2 *2d-7-10*: driven "only once 2d-7-9 has closed or the owner has ruled its rows recorded unread" (entry 21). An agent's message cannot make this ruling. The session that receives it quotes it verbatim in the record's §3 and in a 2d-7-9 notes file, marks 2d-7-9 closed-unread in this checkpoint pair, commits and pushes records only, and relaunches the driver.

**2d-7-9's scope** (record §2 *2d-7-9*; risk **high**; records only; bound by entries 18, 20, 21, 25, 26). It reads: **the foreground case** — the window occluded for more than 10 s until the beats stop, then the owner clicks the Dock icon; the record answers whether `focus` and `visibilitychange` arrive, whether in one task, what drains follow (with the Rust tally) and whether the beats resume; **Tab and default activation and pointer hit-testing**, each with `isTrusted` printed; ***Copy my text*** pressed by the owner and pasted into TextEdit, the owner confirming the text; **⌘Q** with `pagehide` and `unload` observed; **the visual judgements** in EN and ES at a stated window size — the C1 fold on each family, the fixed disabled status control, the `SourceText` marker, the ES row mark, the close and keep labels; **one visible re-take per family**, compared against its hidden twin. **Acceptance, verbatim from the record:** the three visibility conditions are printed at each claim; every G5 row is answered, or named unread with its reason; each owner statement is recorded as the owner's; captures are `-l` window captures only.

**Rows the driven readings handed to 2d-7-9** (each also goes to 2d-7-10's unread-row inventory; 2d-7-9 reads what a visible owner session or a real gesture can read and names the rest unread):
- **2d-7-5** ([`2d-7-5-notes.md`](docs/decisions/2d-7-5-notes.md) §8 items 1, 2, 4, §9): G1 rows 4, 6a, 6b and 7 unread for want of a plan; a per-action no-write claim on a retained plan is unread (S5, entry 16); every visual G1 claim was unread (locked screen), though none is a visual judgement 2d-7-9 owes.
- **2d-7-6-1** ([`2d-7-6-1-notes.md`](docs/decisions/2d-7-6-1-notes.md) §3a, §7 items 1, 4, 7): clause 2 (the per-action no-write witness on all eight surfaces, the recovery form's retained field values) and clause 5 (the locale switch on the authored-text and operation families and the restore pane), by the owner's ruling; the raw editor's *Undo* left enabled under a held save, to be looked at deliberately; every visual G2 claim.
- **2d-7-6-2** ([`2d-7-6-2-notes.md`](docs/decisions/2d-7-6-2-notes.md) §3b, §7 item 1): clause 1's choices — the authored-text reload, *Keep editing* / *Leave this as it is* on every family, copy on authored text and raw's *Copy my text* (copy under a real gesture already sits here, entry 20), the recovery form's own choices; every visual claim but the one capture looked at.
- **2d-7-7** ([`2d-7-7-notes.md`](docs/decisions/2d-7-7-notes.md) §3b): R38's panel/refresh half for all fifteen fixtures, if the owner wants a real external edit of a fixture drawn on a panel.
- **2d-7-8** ([`2d-7-8-notes.md`](docs/decisions/2d-7-8-notes.md) §3, §7 item 1): G4 rows 1-10 and 13, each with its missing plan capability; row 14 (the `visibilitychange` arm, the hidden-state refusal, `pagehide`/`unload` on quit) is 2d-7-9's own.

**After 2d-7-9: 2d-7-10, the consolidation** (record §2 *2d-7-10*; risk routine; driven once 2d-7-9 has closed or been ruled unread): the 2d-7 matrix (every item-7 clause, every consolidated §5.1/§5.2 row and every G row, once each with its class and launch), the ES sentence inventory, the 2d-8 deletion manifest and the carried-forward list; it corrects consolidated §5.4's pre-edit-copies row and `CLAUDE.md` §6's `save_document` location; it re-measures the four gates with the instrument's share derived from a pristine `git archive HEAD` copy. It also classes 2d-7-8's three open items (*Open risks and deviations*). Then 2d-8 removes the instrument.

**Standing constraints for every 2d-7 worker brief** (record §2 preamble, repeated word for word): never run `git stash`, `git checkout`, `git restore` or `git reset` on any path; stage by path, never `src-tauri/src/` as a directory; hook diff stays `5 insertions(+), 1 deletion(-)`; no real corpus; every launch to a fresh bundle path with its language set through the picker.

**The 2d-7 plan** (record §2, ten steps, each one phase with one review): 2d-7-1 stale ruling (high) → 2d-7-2 presentation/comment fixes and the ES mounted cases (routine) → 2d-7-3 instrument, Rust side, including `rustfmt` on `probe.rs` (high) → 2d-7-4 instrument, page side and harness; **its review is THE instrument review** and the cut rule is fixed in §2 (high) → 2d-7-5 … 2d-7-8 window readings (delivery; surfaces and conflicts; R38's fifteen fixtures; 9c's unread states) → **2d-7-9 owner-present, unlocked-screen session: never selected by a driven run.** A driven run reaching it writes `STATUS=BLOCKED` and marks its row `blocked` (entry 21) → 2d-7-10 consolidation. That step waits for 2d-7-9 unless the owner, in their own message, rules 2d-7-9's items recorded as unread. **The instrument stays uncommitted throughout 2d-7**; steps 3 and 4 commit records only (entries 1-8).

**Handed-on items**: every item the 2d-6 sub-steps handed on (11b, 11a, 10, 9c, 9b-3, 9b-2, 9a, 8c) is mapped in the record's §7. The superseded handoff text is archived verbatim in [`next-action-history.md`](docs/progress-archive/next-action-history.md) under *"The 2d-6-11b → 2d-7 design-consult handoff"*. Open item: `CLAUDE.md` §6 names `persist/write.rs` for `save_document`, but it is at `persist/save.rs` (record §5.5); 2d-7-10 fixes it.

**Reviews:** Codex answered again at 2d-7-1 (`autoclaude-review.sh` exited 0), although an earlier record said it was out of quota until 2026-09-26; branch on the script's exit code as usual.

**Orchestrator's rulings standing from 1b's close**: (1) the `ReconciliationWorkspace` interface may be widened as entries require; (2) and (3) re-affirmed by 9a. 9b-3's entry-15 ruling (archived handoff). **The live `stale` ruling is 2d-7-1's** ([`2d-7-1-notes.md`](docs/decisions/2d-7-1-notes.md)); its open items (a failed read or a mid-read surface open/close under a hold, a re-adoption dropping the view, arrival order) are for 2d-7's window readings to meet, not for 2d-7-2.

#### ⚠️ READ FIRST — the working tree is deliberately NOT clean, and that is not a killed phase

`git status --short --untracked-files=all` shows **four uncommitted instrument paths** — `M
src-tauri/src/main.rs` and `M src/main.ts` (two hook lines each; `git diff --stat` over the pair is `5
insertions(+), 1 deletion(-)` and must stay that way), `?? src-tauri/src/probe.rs` and `?? src/probe.ts`.
**Do not commit them, do not revert them, and do not treat them as unaccounted-for work.** They are the
temporary window-reading instrument (`CLAUDE.md` §6, *Window readings*); 2d-8 deletes it. 2d-6-6c-2 extended
`probe.rs`/`probe.ts` (a new `HARNESS_ROOT`, three new commands, WebKit page snapshots —
[`2d-6-6c-2-window-reading.md`](docs/decisions/2d-6-6c-2-window-reading.md) §2). The driver names them in
`AUTOCLAUDE_PREFLIGHT_DIRTY`. **Stage by path**: `PROGRESS.md`, `PROGRESS.json`, `docs/`, `src/lib/browser/`,
`src/lib/i18n/`, `src/lib/ipc/`, and any `src-tauri/` or `src/lib/components/` file **by name** — never
`src-tauri/src/` as a directory. A new `.ts` module costs one Vite module, a new styled component two — re-derive
per file. **A worker must never run `git stash`** (a stash that is not popped loses the instrument silently). Say
so in every worker brief. The screen may be locked during a driven run: 6c-2's reading used WebKit page snapshots
because screen captures were blank.

#### Open items — the live map is the record's §7

`docs/decisions/2d-6-split-notes.md` §7 states, per item, whether the consult **took it into 2d-6** (obligations
(1)-(3), open items 5, 6, 8, 9), **deferred it** (1 — the `file:line` drift checker; 7 — the `"permissions": []`
comment in `main.rs`, 2d-8's; 10 — the `dispose()`-on-close path) or **left it untouched** (0, 2, 3, 4, 11).

#### The rest of the 2d consult, so a step is not invented

**2d-6** (eleven steps, all closed), **2d-7** (the reviewed instrument and the bilingual
WKWebView reading — start from the `fetch` recorder in `src/probe.ts`), **2d-8** (instrument removal and
harness-free closure; corrects the `main.rs` comment and deletes the harness under `/private/tmp/`).
---

## Verification baseline

### Phase 2d-7-7's verification

**`1330 / 462 / 3547 / 201`**, unchanged (no tracked source changed). The worker ran every `CLAUDE.md` §4 gate with the instrument present, each exit 0: `cargo fmt --check`; clippy `-D warnings`; `cargo test --workspace -- --test-threads=1 > /private/tmp/2d7-7-cargo.log` (1330 passed, 0 failed); `npm run check` (462, 0/0); `npm test` (3547); `npm run build` (201; server oracle absent, client oracle 2). Instrument hashes 18/18 equal the frozen set at 16:56:44 and 17:04:43. The orchestrator re-ran, alone, after the worker:
- `/private/tmp/2d7-6-1-hashcheck.sh` at 17:06:56: `summary ok=18 diff=0`, binary `53d84fb2…`.
- `git diff --stat src-tauri/src/main.rs src/main.ts`: `5 insertions(+), 1 deletion(-)`.
- `npm test`: exit 0, `Tests 3547 passed (3547)`.
- `/private/tmp/2d7-7-cargo.log`: 26 `test result: ok` lines, no result line with a non-zero `failed`.
- The review found nothing to fix; no gate re-run was owed.
- The standing-ruling commit of 2026-09-23 touched records only (the record, the notes, this checkpoint pair, the archive); no gate re-run was owed.

### Phase 2d-7-8's verification

**`1330 / 462 / 3547 / 201`**, unchanged (no tracked source changed). The worker ran every `CLAUDE.md` §4 gate with the instrument present, each exit 0: `cargo fmt --check`; clippy `-D warnings`; `cargo test --workspace -- --test-threads=1 > /private/tmp/2d7-8-cargo.log` (1330 passed, 0 failed); `npm run check` (462, 0/0); `npm test` (3547); `npm run build` (201; server oracle absent, client oracle 2). Instrument hashes 18/18 equal the frozen set at 17:19:02 and 17:27:29. The orchestrator re-ran, alone, after the worker:
- `/private/tmp/2d7-6-1-hashcheck.sh` at 17:29:53: `summary ok=18 diff=0`, binary `53d84fb2…`.
- `git diff --stat src-tauri/src/main.rs src/main.ts`: `5 insertions(+), 1 deletion(-)`.
- `npm test`: exit 0, 3547 passed.
- `/private/tmp/2d7-8-cargo.log`: 26 `test result: ok` lines, no failures.
- The review found nothing to fix; no gate re-run was owed.

### Older verification blocks

2d-7-6-2's block is archived in [`phase-2d.md`](docs/progress-archive/phase-2d.md) under *"Phase 2d-7-6-2's verification block"*; 2d-7-6-1's under *"Phase 2d-7-6-1's verification block"*; 2d-7-5's in [`phase-2d.md`](docs/progress-archive/phase-2d.md) under *"Phase 2d-7-5's verification block"*; 2d-7-4-2's under *"Phase 2d-7-4-2's verification block"*. The 2d-7 design consult's and 2d-6-11b's blocks are archived in [`phase-2d.md`](docs/progress-archive/phase-2d.md) under *"The 2d-7 design consult's and 2d-6-11b's verification blocks"*; 2d-7-1's under *"Phase 2d-7-1's verification block"*; 2d-7-2's under *"Phase 2d-7-2's verification block"*; 2d-7-3's under *"Phase 2d-7-3's verification block"*; 2d-7-4-1's under *"Phase 2d-7-4-1's verification block"*.

### The ladder's live rung

**`1330 / 462 / 3547 / 201`** at 2d-7-3, held through 2d-7-4-1, 2d-7-4-2, 2d-7-5, 2d-7-6-1, 2d-7-6-2, 2d-7-7 and 2d-7-8, **with the instrument in the tree** (a committed tree builds 200
modules, and the seven 2d-7-3 Rust tests live in the uncommitted `probe.rs`). Below it `1323 / 462 / 3547 / 201` at 2d-7-2, below that `1323 / 462 / 3539 / 201` at 2d-7-1, below that `1323 / 462 / 3535 / 201` at 2d-6-11b (normalized `1323 / 461 / 3534 / 200`). The rung below that is `1323 / 461 / 3526 / 201` at 2d-6-11a, below that `1323 / 459 / 3382 / 201` at 2d-6-10, below that `1323 / 457 / 3366 / 200` at 2d-6-9c, below that `1323 / 457 / 3365 / 200` at 2d-6-9b-3, below that `1323 / 457 / 3357 / 200` at 2d-6-9b-2, below that `1323 / 456 / 3280 / 198` at 2d-6-9b-1, below that `1323 / 453 / 3218 / 194` at 2d-6-9a, below that `1323 / 449 / 3156 / 193` at 2d-6-8b, held through 2d-6-8c, below that `1323 / 449 / 3083 / 193` at 2d-6-8a, below that `1323 / 449 / 3057 / 193` at 2d-6-7b, held through 2d-6-7c, below that `1323 / 449 / 2964 / 193` at 2d-6-7a, below that `1323 / 449 / 2926 / 193` at 2d-6-6c-2, below that `1323 / 449 / 2920 / 193` at 2d-6-6c-1, below that `1323 / 449 / 2899 / 193` at 2d-6-6b, below that `1323 / 447 / 2833 / 192` at 2d-6-6a, below that `1323 / 447 / 2817 / 192` at 2d-6-5, below that `2754` at 2d-6-4, below that `2669` at 2d-6-3, `2618` at 2d-6-2, `2574` at 2d-6-1c, `2549` at 2d-6-1b and `2520` at
2d-6-1a, below that
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
beside it. These are the ones the next phase needs. The rows of closed chains (2d-3-C, 2d-4a, 2d-5-1-B, 2d-5-2a, 2d-5-3) are under *"Key-path rows of closed chains"* there. The rows of the closed 2d-4b, 2d-5 and 2d-6 steps (2d-4-split, the 2d-4b, 2d-5 and 2d-6 design consults, 2d-6-1c, 2d-6-2, 2d-6-4, 2d-6-5, `DetailPane`/`MatchCreator`, `phase-2d-design.md`) were archived verbatim at 2d-7-8 under *"Key-path rows of the closed 2d-4b, 2d-5 and 2d-6 steps"* there.

| Path | Why it matters next |
|---|---|
| [`docs/decisions/2d-5-7b-window-reading.md`](docs/decisions/2d-5-7b-window-reading.md) · `/private/tmp/espansoconfig-harness-2d-5-7b/` · `src/probe.ts` (uncommitted) | **The window reading that closed 2d-5, and the instrument 2d-7 starts from.** §3 is the `fetch` recorder, §4 the twelve launches with verbatim transcript lines, §5 what is not proved (disposal on close, wake delivery by timing only), §10 where it is thin. The harness is outside the repository and is deleted by 2d-8; `HARNESS_ROOT` in `src-tauri/src/probe.rs` must agree with `launch.sh`'s `HARNESS` |
| [`docs/decisions/2d-7-split-notes.md`](docs/decisions/2d-7-split-notes.md) · [`docs/reviews/phase-2d-7-design.md`](docs/reviews/phase-2d-7-design.md) · [`docs/decisions/2d-7-design-brief.md`](docs/decisions/2d-7-design-brief.md) · [`docs/reviews/phase-2d-7-design-record-review.md`](docs/reviews/phase-2d-7-design-record-review.md) | **2d-7's binding record, which every 2d-7 step works from.** §2 is the ten-step plan with each step's acceptance, risk class and whether it can run driven; §3 holds the 37 rulings (entries 1-8: instrument custody and the single instrument review; entry 21: the driven BLOCKED stop at 2d-7-9; **entry 37: the owner's standing ruling of 2026-09-23 — a row the frozen instrument cannot read is recorded unread and handed to 2d-7-9 and 2d-7-10, so no driven 2d-7 step stops BLOCKED on that again**); §5 lists where it corrects and narrows the consult; §7 is the map of handed-on items |
| [`docs/decisions/2d-7-8-notes.md`](docs/decisions/2d-7-8-notes.md) · [`2d-7-7-notes.md`](docs/decisions/2d-7-7-notes.md) · [`2d-7-6-2-notes.md`](docs/decisions/2d-7-6-2-notes.md) · [`2d-7-6-1-notes.md`](docs/decisions/2d-7-6-1-notes.md) · [`2d-7-5-notes.md`](docs/decisions/2d-7-5-notes.md) | **What 2d-7-9 and 2d-7-10 read.** Each notes file's §3 classes its rows and its §7 (§8 for 2d-7-5) hands on the unread ones with the missing plan capability; the owner rulings are 2d-7-6-1 §3a, 2d-7-6-2 §3b and 2d-7-7 §3b (entry 37) |
| [`src/lib/ipc/events.ts`](src/lib/ipc/events.ts) · [`src/lib/ipc/types.ts`](src/lib/ipc/types.ts) · [`src/lib/ipc/commands.ts`](src/lib/ipc/commands.ts) | **What 2d-4b built.** The injectable event source (imported by nothing yet, deliberately), the reconciliation mirror, and `drainExternalChanges` — which owns no watermark and compares no epoch, because that is 2d-5's |
| [`src/lib/i18n/codes.ts`](src/lib/i18n/codes.ts) | `CODE_NAMESPACE_KEY_BUILDERS` is the general key-without-accessor check — **function references, never namespace strings** — with exactly three exceptions. A new dictionary namespace now fails until it has an accessor |
| [`src-tauri/capabilities/default.json`](src-tauri/capabilities/default.json) | Grants exactly `core:event:allow-listen` and `core:event:allow-unlisten`, added together at 2d-5-7a when `AppShell.svelte` registered the frontend's one event listener; `dispatch_check.rs` pins both and the refusal of emit. **A phase adding any other permission names the narrowest one, never a wildcard** |
| [`src/lib/ipc/commands.ts`](src/lib/ipc/commands.ts) · [`src/lib/browser/workspace.svelte.ts`](src/lib/browser/workspace.svelte.ts) | **Where 2d-4b writes.** The TypeScript side of the wire, and the coordinator every write surface goes through — the `BrowserCommands` drain wrapper and the injectable event-listener wrapper belong here |
| [`src/lib/i18n/codes.ts`](src/lib/i18n/codes.ts) · [`src/lib/i18n/index.ts`](src/lib/i18n/index.ts) | The twelve typed `describe*` builders and their reactive `t*` wrappers — **2d-4b adds to both files.** A component renders a code by calling an accessor, never by building a key |
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
| _**2d-4a** … **2d-7-6-2** — the 27 git-state rows the live head held for the closed 2d-4a, 2d-4b, 2d-5 and 2d-6 chains, the 2d-5, 2d-6 and 2d-7 design consults, and 2d-7-1 … 2d-7-6-2 with their owner rulings (several of them pointers to rows archived earlier)_ | `eced554` … `4fbf565` | ✅ all pushed; **archived verbatim 2026-09-23 at 2d-7-8** to [`status-table.md`](docs/progress-archive/status-table.md) under *"The git-state rows of 2d-4a … 2d-7-6-2, as the live head held them"* |
| _**2d-7-7** and the standing ruling (entry 37) — two rows, `ship` (Codex), rung unchanged_ | `384f4a4`, ruling `78a66db` (SHA records `b0a244a`, `faf6df2`; `dfe0bca` refreshed `PROGRESS.json`) | ✅ pushed; **archived 2026-09-23 at 2d-7-8** to [`status-table.md`](docs/progress-archive/status-table.md) |
| **2d-7-8 — G4: the reconciliation-status states 9c left unread (records only), read, reviewed (`ship`, Codex, 0 findings) and closed under entry 37; the next step, 2d-7-9, is `BLOCKED` on the owner.** The notes, the window reading, the review brief and file, this checkpoint pair, and the archive appends (the 2d-7-7 status and git-state rows, the closed 2d-3 … 2d-6-11b status rows, the older git-state and key-path rows, 2d-7-6-2's verification block, the superseded next action). The instrument stays uncommitted (entry 1); once this commit lands the tree carries only the four instrument paths. Rung unchanged `1330 / 462 / 3547 / 201` | `2aa798a` | ✅ pushed to `origin/main` (`faf6df2..2aa798a`) |
_The round-by-round §7.1 reading for the closed 2d-5-2b chain, the hatch condition C set and D
applied, what the five rounds bought, and the stale-citation sweep taken while E ran, are in
[`status-table.md`](docs/progress-archive/status-table.md) under *"The git-state prose of the closed
2d-5-2b chain"*, archived 2026-09-05. `docs/decisions/2d-5-2b-notes.md` §13-§17 is the authoritative
per-round record. The one finding that outlived that tail — **four stale cross-file citations in
`src/`** — is mapped in `docs/decisions/2d-6-split-notes.md` §7 (item 1, deferred, no phase named)._
