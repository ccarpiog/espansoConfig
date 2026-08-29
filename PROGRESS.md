# PROGRESS — espansoConfig

**This file is the authoritative project state, and it is the live head only.** The conversation is
not project state: a fresh session must be able to resume from this file alone, with no conversation
history.

**Its size budget is 400 lines / 64 KiB soft and 800 / 128 KiB hard**, and a session resuming onto a
file over the hard bound archives first, before anything else. It carries the phase table, the
standing rules, the open risks, the next action, the verification baseline, the key paths and the git
head. Everything a closed phase left behind — its narrative, its verification sections, its review
dispositions and every superseded handoff — is in the archive, and **a phase closing is what
triggers the move**. As of 2d-4a-G it is **over the soft line bound and about to cross the soft byte
bound**: **495 lines and 63,634 bytes**, which is under 64 KiB by less than 2 KiB, after archiving
two spent next-action blocks and two verification blocks during that one iteration. **The next
session should archive before it writes** — the phase-2d-4a tail adds roughly one verification block
and one next-action block per phase, and each is 40–100 lines. The next places to look for length
are *Open risks and deviations* and the *Next action*'s narrative half, not the phase table.

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
| **2d-4a** | The Rust half of the reconciliation wire — the queue, `ReconciliationWake`, `drain_external_changes`, the wire types, the EN/ES JSON | 🔶 **implemented, every gate green, and NOT closed** — **twelve** rounds run; superseded by 2d-4a-D, that by 2d-4a-E, that by 2d-4a-F, that by 2d-4a-G, and that by 2d-4a-H |
| **2d-4a-D** | First corrective phase: round 9's review of the round-8 fix | 🔶 **ran in full, every gate green, NOT closed** — **`do-not-ship`**, 2 High + 3 Medium, all fixed; **superseded by 2d-4a-E** |
| **2d-4a-E** | Second corrective phase: round 10's review of the round-9 fix | 🔶 **ran in full, every gate green, NOT closed** — `ship-with-fixes`, **0 High**, 2 Medium + 2 Low, three fixed and one declined with a recorded reason; **it cleared round 9's two Highs by its own derivation**; **superseded by 2d-4a-F** |
| **2d-4a-F** | Third corrective phase: round 11's review of the round-10 fix — two comment edits in one file | 🔶 **ran in full, every gate green, NOT closed** — **`do-not-ship`**, **1 High** + 1 Medium + 1 Low, all three fixed; the High is a clause **older than the fix under review** that four rounds had read past; **superseded by 2d-4a-G** |
| **2d-4a-G** | Fourth corrective phase: round 12's review of the round-11 fix — one comment edit in one file | 🔶 **ran in full, every gate green, NOT closed** — `ship-with-fixes`, **0 High**, 2 Medium + 3 Low, **all five fixed**; **it cleared round 11's repair by deriving `evictable_sequence`'s independence from the assertion**; **superseded by 2d-4a-H** |
| **2d-4a-H** | Fifth corrective phase: round 13's review of the round-12 fix — one comment edit in one file | ⬜️ not started — **this is the next action**. Two source Lows were fixed rather than carried, on the merits recorded in §21.1, and that is what commissions it |
| **2d-4a-C-1** | The scoped-lifetime contract, stated once, and its pointers | ✅ complete and **CLOSED** — four rounds, round 4 READY with 0 findings |
| **2d-4a-C-2** | The check that keeps it — `src-tauri/src/prose_sweep.rs` and `src-tauri/src/retained_state_contract.rs` | ✅ implemented, every gate green, **CLOSED by owner decision 2026-08-29** after nine rounds |
| **2d-4b** | The TypeScript half of the wire — spec `docs/decisions/2d-4-split-notes.md` §2 | ⬜️ not started |
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
- Sweep for the shape a finding names, never for the words it used; every narrower instance this
  project has shipped was missed by searching the previous wording.

---

## Open risks and deviations

Live risks in full, then the ones that are demonstrably closed, compacted to one line each with the
decision that closed them — those decisions are in
[`docs/progress-archive/decisions.md`](docs/progress-archive/decisions.md).

| # | Risk | Mitigation / state |
|---|---|---|
| R1 | `saphyr-parser` is **pre-1.0 (0.0.11)**; the API can break between patch releases | Confined to `crate::syntax` — no other module imports it. 31 pinned tests fail loudly on any behaviour change. Deliberately **not** vendored: vendoring creates ownership without removing upgrade risk. |
| R2 | If a future saphyr release "fixes" `index()` to genuinely return bytes, the `CharToByte` adapter silently becomes wrong | Desired failure mode already wired: `all_three_crates_report_character_offsets_not_byte_offsets` and `saphyr_offsets_count_unicode_scalar_values_not_bytes_utf16_units_or_graphemes` both fail immediately. |
| R5 | An empty block scalar (`replace: \|` mid-keystroke) reports a span that **includes** its header — the one exception to "the header is outside the span" | Phase 0b: the backwards header lexer must refuse to run when the span itself starts with `\|` or `>`. Pinned by `a_truncated_block_scalar_header_produces_a_span_that_swallows_the_header`. The content span now starts past the header *line*, never past the indicator alone, so rewriting it cannot splice a value onto the header line. |
| R12 | **Refusal for anchors, aliases, tags, merge keys, duplicate keys and multi-document streams is broad, and was previously recorded here as *total*.** A file using any of them is largely, but not entirely, non-editable in the visual UI | Accepted, and it is the specified behaviour: plan §7 rows 7–8 say *detect and refuse*, and §13 defers visual editing of anchors, aliases, tags and merge keys out of v1. **"Total" was wrong, and 0c-2b measured it.** The gate refuses the flagged node, its ancestors and its descendants, so a **sibling** stays editable: `anchors-aliases-tags-merge.yml` refuses 12 addressable scalars and **applies 5** — `matches[2].trigger` is editable although the explicit-tag hazard sits on the `replace` beside it — and `duplicate-keys.yml` is 2 refused / 8 applied. Only a hazard on a **document** node reaches everything, which is why `multi-document.yml` really is total. The gate's behaviour is unchanged and safe; only this prose needed narrowing. Pinned by `the_hazard_gate_refuses_by_scope_and_not_by_file`. R12's other claim is confirmed: **2 004 of 2 004** attempted real-corpus edits applied, zero refusals, so the breadth costs this corpus nothing today. If a future corpus does trip it, the escape hatch is a *narrower* hazard scope, not a weaker gate. |
| R13 | **Duplicate-key detection compares decoded scalar values only.** A non-scalar key — an alias or a collection used as a mapping key — is skipped by the duplicate check | Accepted: every such key already raises `AliasReference` or sits inside a refused construct, so the mapping is refused anyway. Revisit only if a case appears where a non-scalar key exists without any other hazard. |
| R9 | The missing evaluation criterion is **replacement-envelope correctness**, not endpoint accuracy | Phase 0c. Mutate real documents and assert: the span matches the requested structural path despite duplicate keys, nested sequence mappings, merge keys, aliases, explicit keys and empty values; the replacement reparses to the intended value and stays valid YAML; every byte outside the envelope is identical (CRLF/LF, BOM, missing final newline, trailing spaces, comments, block-scalar terminal newlines). This is the Phase 0 gate's round-trip property test. |
| R15 | **`NonCanonicalEscaping` is deliberately over-broad**: it refuses every double-quoted source containing any backslash, including already-canonical `\\`, `\"`, `\n`, `\t` | Accepted for now, and safe — it only costs the ability to re-encode such a scalar byte-identically, never correctness. Carries a `TODO(0c-2)` in its doc comment. Narrow it only if 0c-2 finds real files where editing an escaped double-quoted value matters. |
| R16 | **The round-trip oracle parses with saphyr (YAML 1.2), but espanso consumes with a YAML 1.1-ish stack.** Agreement with saphyr does not prove the file means the same thing to espanso | **Partly closed in 0c-3b-2b (D2s), and the open half is stated so it cannot be mistaken for mitigated.** *R16 stays open: byte preservation and conservative emission prevent edits from changing untouched bytes or introducing known YAML 1.1-ambiguous plain scalars, but the UI projection of pre-existing plain scalars is not yet proven to match espanso's resolver.* **Closed half:** an in-house 1.1/1.2-core tag table in the library, consulted by the emitter and asserted in `verify()` as a differential property, so an edit can neither introduce a new ambiguity nor change an existing classification. Building it found D2h's predicate writing **34 distinct 1.1-ambiguous values plain** — a real corruption path, now fixed. **Open half:** the *projection*. 31 synthetic and 65 real plain scalars resolve non-`str` under 1.1 today; the app would display them as strings. **The UI consequence is settled by D2u — the browser shows source text, never an inferred type — so the open half costs display richness, not correctness.** R16 closes only when the projection is proven against espanso's actual resolver, which is also what would unlock type-aware rendering. **Residual risk:** a pre-existing or explicitly tagged scalar may be displayed or used by the typed projection with a different type/value than espanso assigns, and an incomplete hand-maintained resolver table or an espanso-specific schema change could leave that disagreement undetected. **Two named weaknesses:** explicit tags are outside the table entirely, and the **1.2-core half has no second implementation** (the 1.1 half has one, differentially swept over 500 000 values with zero disagreements). Deliberately **no second parser crate** — see D2s for why, and do not add one without re-reading it. |
| R18 | **A node in key position cannot be verified by the path that found it.** Renaming the `replace` of `replace: old` makes the path `replace` resolve to `NoSuchKey` in the reparsed document, so the verify step fails on a *correct* edit | Accepted and bounded. A scalar edit targets `Resolved::value` only; `resolve_key` exists for the **spans** a structural edit needs (where an entry begins, so removing it takes its key too), not as an edit target. Documented on `resolve_key` itself. A key-rename operation needs its own protocol — verify against the **intended new** path, not the old one — and is 0c-3's problem if it is wanted at all. Editing an ordinary value that merely equals some other entry's key string is harmless. |
| R10 | A block scalar whose header cannot be located has **no correct span**: the reported one runs into trailing blank lines and the next node's indentation | The index is **rejected** with `InvariantViolation::BlockHeaderNotFound` rather than publishing the known-bad span. There is deliberately no fallback. From the Phase 0b-1 review, ranked failure mode 3. |
| R11 | **Terminal spaces or tabs at end-of-source** are scalar content, not the next token's indentation — there is no next token | `block::content_len` takes `at_end_of_source` and keeps a trailing run that sits on a content line. Pinned by `terminal_spaces_at_end_of_source_stay_inside_the_block_scalar` and the `block-scalar-terminal-spaces.yml` fixture. |
| R23 | **A comment a removal *keeps* can be absorbed by a block scalar above it**, changing that block's decoded value although nothing about it was edited — the shape neither D2o nor the 0c-3a review named | Accepted and refused by name (`EditError::RemovalWouldExtendABlockScalar`), the twin of `RemovalWouldExtendAKeptBlock`. **Narrowed by the 0c-3b-1 review's finding 2, which found the first form over-broad.** It now fires on three clauses, not two: the removal has something to preserve, *and* some block scalar's content ends at or before the envelope's first run with nothing but blank lines in between, *and* **the first non-blank line the removal preserves sits at that block's own body column or deeper**. A shallower line ends the block instead of extending it, exactly as the removed entry's key already did, so the reviewer's `>` block above a column-zero comment is a legal removal and is pinned byte-exactly. The body column is `ScalarPresentation::indent`, **read off the span layer and never re-lexed** (D2/D2d); the earlier "only reconstructible" objection was about a block's *end*, not its body column. One case still refuses unconditionally: a block whose content span is **empty** (`replace: \|` with the next sibling under it, the R5 shape), where `indent` holds the header's column rather than any observed body's. Costs the synthetic corpus **1** attempt, in `run-based-removal-envelope.yml`, and the real corpus **0** — unchanged by the narrowing, which let one attempt through and turned none away. `run-based-removal-boundaries.yml` pins the safe side. |
| R22 | **`InconsistentEntryIndentation` is pinned at 0 and is argued to be *unreachable*, not merely unreached** — a coverage hole and a proof look identical in a count | Accepted, with the argument recorded in `docs/decisions/0c-3a-notes.md` §3: a valid block mapping cannot have its keys at two columns, and the two shapes that can are refused earlier by other variants. No fixture was invented to reach it, because an impossible fixture would prove nothing. This is the one refusal family whose pinned zero rests on an argument rather than on a construction — treat it as the weakest pin in the table, and revisit if a real file ever trips it. |
| R25 | **Move verification is not compositional** — `MoveMustBeTheOnlyEditInItsBatch` refuses a batch pairing a move with any other edit, including the safe and obvious "move this match and change its `replace`" | Accepted as a **deliberate phase-scope limit, not an invariant**, and relabelled as such after the 0c-3b-2a review found the original circularity argument unconvincing. It conceals no demonstrated splice-order bug — a single move still exercises descending application of its own runs. Two costs, both recorded: the safe combined request above is refused, and **`OverlappingEdits` is consequently never tested against a move-versus-edit conflict**, because the restriction rejects such batches before overlap analysis runs. Closing it means applying the permutation to a combined expectation and exempting precisely the independently verified rewritten node, which is how field batching already works. Revisit when the UI needs it or when cross-file move lands. |
| R26 | **`shares_a_line` and the move sweep's second derivation of `comment_ownership_survives` are pinned or covered more weakly than the rest** | Accepted and named rather than papered over. `shares_a_line` is **reachable** — via a compact nested sequence such as `outer[0][1]` in `- - first` — and is driven by a hand-written unit test rather than a corpus fixture, because neither corpus holds that shape; it is weaker than corpus coverage and R20's rule would prefer a fixture. `comment_ownership_survives` has a production derivation but **no independent second derivation in the sweep**, deferred on R19 cost grounds (`docs/decisions/0c-3b-2a-notes.md` §3.4). Both are the weakest pins added by 0c-3b-2a; R22 remains the weakest in the table overall. |
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

### Rounds 11 and 12 both RAN today. The next action is **Phase 2d-4a-H** — round 13's review of the
### round-12 fix — then **Phase 2d-4b**.

**🛑 Do not run a step-2 round 10 of 2d-4a-C.** That tail is closed by owner decision; reopening it
needs a new owner ruling. **2d-4a's own tail is a different tail** and is the one that is live — it
has now run *thirteen* numbered positions, so a bare round number is ambiguous between the two. Check
which tail before acting. The spent next-action blocks are in
[`docs/progress-archive/next-action-history.md`](docs/progress-archive/next-action-history.md), which
is **history and never an instruction**.

#### What happened on 2026-08-29, under `/autoclaude-opus` in driven mode

**Four corrective phases have now run to completion: 2d-4a-D, -E, -F and -G.** Each was commissioned
by `CLAUDE.md` §7.1 because the fix before it changed a source file, and each spent the workflow's
single per-phase review invocation.

| Round | Phase | Verdict | Findings | Report |
|---|---|---|---|---|
| 9 | 2d-4a-D | **do-not-ship** | **2 High**, 3 Medium | [`…round-9.md`](docs/reviews/phase-2d-4a-round-9.md) |
| 10 | 2d-4a-E | ship-with-fixes | 0 High, 2 Medium, 2 Low | [`…round-10.md`](docs/reviews/phase-2d-4a-round-10.md) |
| 11 | 2d-4a-F | **do-not-ship** | **1 High**, 1 Medium, 1 Low | [`…round-11.md`](docs/reviews/phase-2d-4a-round-11.md) |
| 12 | 2d-4a-G | ship-with-fixes | **0 High**, 2 Medium, 3 Low | [`…round-12.md`](docs/reviews/phase-2d-4a-round-12.md) |

The record is [`docs/decisions/2d-4a-notes.md`](docs/decisions/2d-4a-notes.md) **§18** … **§21**, one
section per round; the briefs are `docs/decisions/2d-4a-{D,E,F,G}-round-{9,10,11,12}-brief.md`.

#### 🟢 What round 12 cleared, and the one shape it found twice

**It cleared round 11's repair at the level round 11 attacked.** `evictable_sequence` (`:921-935`) is
a pure function of `pending` over paths, counts and sequences, reading no `DocumentId` and no
assertion state, **with no coupling direct or indirect** — so *"never because it is the entry that
trips here"*, *"when `evictable_sequence` picks it"*, *"an overflow that selects this entry"* and
`retained_state_contract.rs:1089`'s *"an overflow evicting **it**"* are now **all true together**. It
also checked the **preserved** clauses rather than assuming them (`drain`'s two mutations, `enqueue`'s
`while … > QUEUE_CAPACITY`, all three `PoisonError::into_inner` sites), confirmed §20.2's figures, and
agreed for the **third** round that round 10's L2 stays declined.

**Its two Mediums and one Low are one shape: a figure measured over one span and labelled with
another.** The round-11 block said its link count listed *"the doc comment"* when it listed the
**paragraph** (the doc comment gives 13 over 10; the paragraph gives the six over five it reports);
§20.4's *"83 citations"* was `rg -c`, which counts **lines** — `rg -o … | wc -l` gives **85**; and the
round-10 block it all descends from labelled a **hunk's** count as the paragraph's. **Three
instances, three rounds, one shape**, each found by re-deriving the figure rather than re-reading the
sentence. All three are corrected.

**Its second Medium is the sharper one.** §20.4 said *"H1 is older than the fix under review"*, which
is true of the words and misleading about the defect: pre-M1 the *not* sat beside a **concrete
criterion**, under which it read as criterion-versus-criterion and was true. M1 deleted that
criterion, substituted *"whatever that rule names"*, and strengthened *not* into *never*. **M1 is a
contributing cause, not merely a preserver**, so the record no longer implies four rounds had read the
defect.

#### Step 1 — Phase 2d-4a-H, the fifth corrective phase (THE NEXT ACTION)

**Why it exists.** Round 12's two source Lows were **fixed rather than carried** — §7.3 would have
permitted carrying either, and §21.1 records the merits that decided otherwise: L2 broke the
punctuation of the three-item list **both Highs of this tail were miscounts of**, and L1's ambiguous
clause was one round old and duplicated the paragraph's own summary. That fix changed
`src-tauri/src/reconciliation.rs` (**+3 / −4**, comment-only), so §7.1 commissions **round 13**, and
§7.4 carries the debt into this phase. **2d-4a-G is superseded by 2d-4a-H, never complete.**

**Four things the round-13 brief should carry**, all from 2d-4a-G:

1. **The edit under review** at `reconciliation.rs` ~1498–1505. It does two things at once: it turns
   the full stop after *clause 5* back into a comma with an appositive (*"a rule that does not know
   this assertion exists"*), restoring the *A; B; and C* list, and it **deletes** the clause *"so this
   escape waits on a state it cannot bring about"*. Ask whether the appositive's antecedent is any
   clearer than the pronoun it replaced, and whether deleting the clause lost anything the summary at
   `:1509-1510` does not already carry.
2. **This paragraph has produced two Highs in twelve rounds, both enumeration miscounts**, and round
   12's L2 was a punctuation change that damaged the same enumeration. **Count the list.** The
   preserved clauses are in scope for the same reason: a rewrite is not a review of what it preserves.
3. **"Measure one span, label another" is now a named shape** (§21.4), found three times in three
   rounds. Every figure §21 cites — `+3 / −4`, *every line begins `///`*, *six over five*, *13 over
   10*, the 88/61 phrase families — is the fix round's own derivation. **Re-derive them**, and check
   each is labelled with the span it was taken over.
4. **L2 of round 10 stays declined on three rounds' reading.** Say so in the brief so round 13 does
   not spend budget rediscovering it.

Dispatch it as before: a fresh `autoclaude-reviewer` on `model: "opus"` that did not write the code,
briefed from [`docs/decisions/2d-4a-G-round-12-brief.md`](docs/decisions/2d-4a-G-round-12-brief.md)'s
shape, writing to `docs/reviews/phase-2d-4a-round-13.md`. **That would be the seventh consecutive
Opus round — now longer than the six-round Codex run it replaced.** To break it,
[`docs/decisions/codex-dispatch-procedure.md`](docs/decisions/codex-dispatch-procedure.md) is the
route: a `/goahead` procedure, not an `/autoclaude` one, and its known failure modes are worth reading
before choosing it inside a driven single-shot session.

#### Step 2 — Phase 2d-4b

Spec: [`docs/decisions/2d-4-split-notes.md`](docs/decisions/2d-4-split-notes.md) §2 — the mirrored
TypeScript types, the `BrowserCommands` wrapper for the drain, the **injectable** event-listener
wrapper, the `describe*` builders in `src/lib/i18n/codes.ts` with their reactive `t*` wrappers in
`index.ts`, the frontend tests, and the re-measured `npm run check` / `npm test` / `npm run build`
baselines. Its four inherited constraints are listed at the end of the round-7 brief. By the standing
rule since 2b-2c, a design consult comes before any line of it is written.

## Verification baseline

**`1313 / 431 / 2125 / 184`** — `cargo test --workspace` / `npm run check` files / `npm test` /
`npm run build` modules. **Re-measured end to end on 2026-08-29**, three times in one iteration: at `f7bbf6d` before round 11
was dispatched, on the tree 2d-4a-F's fix produced, and on the tree 2d-4a-G's fix produced. The Cargo
figures were re-run each time; the three frontend figures were measured once at the head of the
iteration and no `src/` file changed in any of its phases. **Any
step that touches `src/` must re-measure the three frontend figures**, and a figure produced by a
tree carrying a probe harness is never copied forward — that scar is recorded in `CLAUDE.md` §4.

**Neither the round-11 nor the round-12 fix moved a count**, which is the expected result: each
changed one sentence of one doc comment, and a comment is not a test. Both were also checked *before*
being applied, by counting all 88 retained-state and 61 liveness phrases against the exact prose
removed and the exact prose added — none occurs in either — and `cargo test --workspace` is what
proves it. **That check is the fix round's own**: round 12 states under `NOT-VERIFIED` that it did not
walk the phrase families, so it has one pair of eyes on it rather than two.

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

### Phase 2d-4a-G — round 12 (2026-08-29, `/autoclaude-opus`, driven mode)

**Reviews: 1/1 — the workflow's whole per-phase allowance. Verdict `ship-with-fixes`: 0 High, 2
Medium, 3 Low — two Mediums in the record, two Lows in source, one Low in the record. All five
fixed.** Reviewer: a fresh `autoclaude-reviewer` on `model: "opus"`, briefed from
[`docs/decisions/2d-4a-G-round-12-brief.md`](docs/decisions/2d-4a-G-round-12-brief.md), writing its
own report to [`docs/reviews/phase-2d-4a-round-12.md`](docs/reviews/phase-2d-4a-round-12.md). Not
reproduced into the queue, for the reason §18 gives. **The sixth consecutive Opus round.**

- **What it cleared is the substantive result.** `evictable_sequence` (`:921-935`) is a pure function
  of `pending` over paths, counts and sequences, reading no assertion state, so round 11's repair is
  true and **four statements that round 11 found in contradiction are now consistent**. It also
  checked the **preserved** clauses rather than assuming them — `drain`'s two mutations, `enqueue`'s
  `while … > QUEUE_CAPACITY`, all three `PoisonError::into_inner` sites — verified §20.2's figures,
  and agreed for the **third** round that round 10's L2 stays declined.
- **M1 + L3 (record)** — the same shape twice: the round-11 block said its link count listed *"the
  doc comment"* when it listed the **paragraph** (13 over 10 vs six over five), and §20.4's *"83
  citations"* was `rg -c`, which counts **lines** — `rg -o … | wc -l` gives **85** over the same nine
  files. Both corrected by round-12 blocks, both figures re-derived over both spans.
- **M2 (record)** — *"H1 is older than the fix under review"* is true of the words and misleading
  about the defect: pre-M1 the *not* sat beside a **concrete criterion** and read as
  criterion-versus-criterion. M1 deleted the criterion, substituted *"whatever that rule names"* and
  strengthened *not* → *never*. **M1 is a contributing cause, not merely a preserver.** Corrected.
- **L1 + L2 (source, one edit)** — *"so this escape waits on a state it cannot bring about"* had three
  candidate antecedents and duplicated the summary at `:1509-1510`; and the full stop after *clause 5*
  had broken the three-item list so item 3 hung off item 2's second sentence. **Fixed together**: the
  full stop becomes a comma with an appositive, and the ambiguous clause is deleted. **+3 / −4, every
  line `///`.**
- **Why those two were fixed rather than carried** — §7.3 permitted carrying either. §21.1 records the
  merits: L2 damaged the enumeration **both Highs of this tail were miscounts of**, and L1's clause
  was one round old. **Neither *it would end the tail* nor *it would commission a round* was an
  input.**
- **Round 13 is owed and cannot run here.** §7.1 commissions it, the one-invocation cap is spent, and
  §7.4 makes the debt a corrective phase. **2d-4a-G is superseded by 2d-4a-H, never complete.**

**Gates on the tree this iteration produced**, measured by the orchestrator alone, each command
issued separately and **redirected to a file rather than piped**, so every status is the tool's own:
`cargo test --workspace` **1313** passed / 0 failed over **26** result lines all `ok`, exit 0; `clippy -D warnings` clean; `cargo fmt --check` clean;
`cargo doc --workspace --no-deps` **73** warnings, all `private_intra_doc_links`, and **0 unresolved**, run after `touch`ing `reconciliation.rs`; `cargo tree -p espansoconfig-core | rg tauri` empty;
`npm run check` **431** files / 0 errors / 0 warnings; `npm test` **2125** over **56** files; `npm run
build` **184** modules, server oracle absent and client oracle present with 2 matches. **The three
frontend figures were measured at the start of this iteration**, and no `src/` file changed in any of
its phases.

### Phase 2d-4a-F — round 11 (2026-08-29, `/autoclaude-opus`, driven mode)

**Archived** at [`docs/progress-archive/phase-2d.md`](docs/progress-archive/phase-2d.md), verbatim,
now that 2d-4a-G has replaced it as the live narrative. In one line: verdict **`do-not-ship`**, **1
High** — the eviction sentence's *never* denying the very state its own escape requires — plus 1
Medium and 1 Low, all three fixed, and round 12 then cleared the repair by deriving
`evictable_sequence`'s independence from the assertion. Round 11's own record is
[`docs/decisions/2d-4a-notes.md`](docs/decisions/2d-4a-notes.md) §20; the report is
[`docs/reviews/phase-2d-4a-round-11.md`](docs/reviews/phase-2d-4a-round-11.md).

### Phase 2d-4a-E — round 10 (2026-08-29, `/autoclaude-opus`, driven mode)

**Archived** at [`docs/progress-archive/phase-2d.md`](docs/progress-archive/phase-2d.md), verbatim,
now that 2d-4a-F has replaced it as the live narrative. In one line: verdict **`ship-with-fixes`**,
0 High, 2 Medium and 2 Low, three fixed and L2 declined with its argument recorded — and round 11
then found a **High** in the clause M1 kept while rewriting the sentence around it. Round 10's own
record is [`docs/decisions/2d-4a-notes.md`](docs/decisions/2d-4a-notes.md) §19; the report is
[`docs/reviews/phase-2d-4a-round-10.md`](docs/reviews/phase-2d-4a-round-10.md).

### Phase 2d-4a-D — round 9 (2026-08-29, `/autoclaude-opus`, driven mode)

**Archived** at [`docs/progress-archive/phase-2d.md`](docs/progress-archive/phase-2d.md), verbatim,
now that 2d-4a-E has replaced it as the live narrative. In one line: verdict **`do-not-ship`**, 2
High and 3 Medium, every finding fixed, and round 10 then cleared both Highs by its own derivation.
Round 9's own record is [`docs/decisions/2d-4a-notes.md`](docs/decisions/2d-4a-notes.md) §18; the
report is [`docs/reviews/phase-2d-4a-round-9.md`](docs/reviews/phase-2d-4a-round-9.md).

### Phase M2 — the review-tail termination rule (2026-08-29)

**Closed**; narrative at [`docs/progress-archive/phase-m2.md`](docs/progress-archive/phase-m2.md),
both rounds verbatim at
[`docs/reviews/phase-M2-review-tail-termination.md`](docs/reviews/phase-M2-review-tail-termination.md).
Two rounds, both `not-ready`, every finding fixed, and **no source file changed** — so the rule M2
installed commissioned nothing on its own first application.

---

## Key paths

The full path index, with a paragraph on why each mattered to its phase, is in
[`docs/progress-archive/status-table.md`](docs/progress-archive/status-table.md) and the phase files
beside it. These are the ones the next phase needs.

| Path | Why it matters next |
|---|---|
| [`docs/reviews/phase-2d-4a-round-12.md`](docs/reviews/phase-2d-4a-round-12.md) | **What 2d-4a-H reviews the fix to.** Round 12's report — `ship-with-fixes`, 0 High — and the one-sentence diff its fix produced is round 13's whole scope. Read its *Cleared by derivation* section too: it is what round 13 need not redo |
| [`docs/decisions/2d-4a-G-round-12-brief.md`](docs/decisions/2d-4a-G-round-12-brief.md) | **The shape round 13's brief should copy.** For the `autoclaude-reviewer`, not for Codex; note how it names the consecutive-Opus bound to the reviewer rather than hiding it, and how it tells the round which previously declined finding *not* to spend budget on |
| [`docs/reviews/phase-2d-4a-round-11.md`](docs/reviews/phase-2d-4a-round-11.md) | Round 11's report — the High that four Opus rounds had read past, and the repair round 12 then cleared |
| [`docs/decisions/codex-dispatch-procedure.md`](docs/decisions/codex-dispatch-procedure.md) | Read **only if** round 13 goes to Codex to break what would otherwise be a **seven**-round Opus run — longer than the six-round Codex run it replaced. A `/goahead` procedure, not an `/autoclaude` one: the dispatch, the collection, and what to do when Codex returns a limit rather than a review |
| [`docs/decisions/2d-4a-round-7-brief.md`](docs/decisions/2d-4a-round-7-brief.md) | Round 7's brief, now spent — but **2d-4b's four inherited constraints are still live at its end** |
| [`docs/decisions/2d-4-split-notes.md`](docs/decisions/2d-4-split-notes.md) | §2 is 2d-4b's whole spec; §3 says why the EN/ES JSON is in 4a and the accessors in 4b; §4 says what neither step does |
| [`docs/reviews/phase-2d-4a-queue.md`](docs/reviews/phase-2d-4a-queue.md) | 2d-4a's work list — rounds 1–8 verbatim, newest last. **Round 9 is deliberately not in it**, and the file says why: the queue preserves replies that lived only in a transcript, and round 9's reviewer wrote its own file |
| [`docs/decisions/2d-4a-notes.md`](docs/decisions/2d-4a-notes.md) | 2d-4a's record; **§21 is round 12** and ends with what round 13 inherits, §20 is round 11, §19 round 10, §18 round 9, §15 the round-6 fix, §9 the residues. The correction blocks: §17 carries four round-9 ones; §18.3 a round-10 one, a round-11 one and a round-12 one; §19.1 a round-11 one; §20.4 two round-12 ones |
| [`docs/decisions/2d-4a-C-notes.md`](docs/decisions/2d-4a-C-notes.md) | The mechanism's record; §25 is round 9, §26 and Appendix A the reorganization, §24.7 the gate table |
| [`docs/reviews/phase-2d-4a-C.md`](docs/reviews/phase-2d-4a-C.md) | Step 1 rounds 1–4 and step 2 rounds 1–9, each verbatim |
| [`docs/decisions/2d-3-C-notes.md`](docs/decisions/2d-3-C-notes.md) | The precedent for ending a tail, and §4.4 is the proof-it-fails evidence standard |
| [`docs/reviews/phase-2d-design.md`](docs/reviews/phase-2d-design.md) | The consult that shaped Phase 2d into eight steps, and Q8's sharpest green-suite failure |
| [`src-tauri/src/prose_sweep.rs`](src-tauri/src/prose_sweep.rs) | The shared sweep machinery both contract checks use; its module doc states the family's limits |
| [`src-tauri/src/retained_state_contract.rs`](src-tauri/src/retained_state_contract.rs) | The retained-state guard 2d-4a-C-2 built |
| [`src-tauri/src/liveness_contract.rs`](src-tauri/src/liveness_contract.rs) | The sibling guard and the working template for both |
| [`crates/espansoconfig-core/src/watch/retained_state.rs`](crates/espansoconfig-core/src/watch/retained_state.rs) · [`liveness.rs`](crates/espansoconfig-core/src/watch/liveness.rs) | The two contracts those checks enforce |
| [`src-tauri/src/commands.rs`](src-tauri/src/commands.rs) · [`save.rs`](src-tauri/src/save.rs) | The twelve commands; `run_one_save` holds the layer's single cache-coherency policy |
| [`src-tauri/src/wire_contract.rs`](src-tauri/src/wire_contract.rs) · [`dictionary_contract.rs`](src-tauri/src/dictionary_contract.rs) | The two exhaustiveness checks a new wire type or code must satisfy |
| [`src/lib/ipc/commands.ts`](src/lib/ipc/commands.ts) · [`src/lib/browser/workspace.svelte.ts`](src/lib/browser/workspace.svelte.ts) | The TypeScript side of the wire, and the coordinator every write surface goes through |
| [`src/lib/browser/saveOutcome.ts`](src/lib/browser/saveOutcome.ts) · [`editorSave.ts`](src/lib/browser/editorSave.ts) | `conflictChoicesFor` is the only producer of a choice list; `adoptDiskVersion` is the only confirmed-install door |
| [`src/lib/i18n/codes.ts`](src/lib/i18n/codes.ts) | The twelve typed `describe*` builders — 2d-4b adds to this file and to `index.ts` |
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
| **2d-4a-G — round 12 and its fix; round 13 OWED** | G_SHA | G_PUSH |

**Each of those source commits is what makes the next round owed.** `125dfa8` changed five files
under `src-tauri/src/` and made round 9 owed; `6572a29` changed two — the M1 doc paragraph in
`reconciliation.rs` and one `reason` string in `retained_state_contract.rs`'s `INVENTORY` — and made
round 10 owed; `22d1afb` changed **one**, two comment hunks in `reconciliation.rs`, and made round
11 owed; `b854de5` changed **one**, a single sentence of the same doc comment (+4 / −3), and made
round **12** owed; and this phase's commit changes **one**, the punctuation of that same sentence and
one deleted clause (+3 / −4), and makes round **13** owed. **Every one of them is comment or
inventory prose with no executable line changed**, and under §7.1 the unit is the file, so each still
commissions a round.
