Reviewer: autoclaude adversarial reviewer

# Phase 2d-4a-E — review round 10

Scope: commit `6572a29`, its two source hunks and §18 / the four round-9 correction blocks.
No gate was run (the brief forbids it). Verdict: **ship-with-fixes** — 0 High, 2 Medium, 2 Low.

### Verified by derivation

- The three-item list is **right at three** and none of the three is a member that does not belong.
  `pending` is mutated in exactly four places (`enqueue` insert `:1096`, eviction `:1098-1104`,
  `drain`'s retain `:1187-1189`, `begin_epoch`'s whole-state assignment `:1030`); the insert is not
  an exit. Each of the three removes the offending entry and precedes/avoids the projection loop
  (`:1191-1197`). **No fourth way found.**
- "every lock in this module does": all eight `.lock()` calls in `reconciliation.rs` (951, 991,
  1030, 1089, 1128, 1185, 1225, 1235) go through `PoisonError::into_inner`. The session lock does
  too (`commands.rs:1459`).
- The clause-4 hand-off restates clause 4's caveat faithfully — "a fifth mutation site" matches
  clause 4's "not by anything that fails when a fifth appears" over "exactly four places".
- **"comment-only" is true of the `reconciliation.rs` hunk** — every changed line begins `///` — and
  §18.2/§18.3 scope it to that file, naming the `INVENTORY` string separately.
- **"No `INVENTORY` count moved":** I re-derived it by counting all 88 `RETAINED_STATE_SHAPES` and
  all 61 liveness phrases over both changed files at `6572a29^` and `6572a29`, raw and with comment
  markers stripped and whitespace collapsed. **Zero counts moved.** Limits under NOT-VERIFIED.
- §18.4's third-claim argument holds for **both** Highs: H2's defect was a wrong clause *inside* a
  `reason`, which is not part of the guard's `(file, phrase)` key either.

### Findings

**[Medium] `src-tauri/src/reconciliation.rs:1499-1503` — the eviction condition drops clause 5's
tie-break and cites no clause.** *"the victim is the lowest pending sequence of the path holding the
most"*. `evictable_sequence` (`:933`) is `min_by_key(|(count, lowest)| (Reverse(*count), *lowest))`:
under a tie for *most*, the lower **lowest sequence** wins. `retained_state.rs` clause 5 states that
("ties between equally busy paths broken by the lower of their lowest sequences"); the paragraph
paraphrases clause 5 partially and links neither clause 5 nor the module for this sentence — the
paraphrase surface `retained_state` exists to remove. Source; a fix commissions round 11.

**[Medium] `src-tauri/src/reconciliation.rs:1513-1516` — the paragraph restates the clause it hands
the count to.** `retained_state.rs:59-61`: *"A pointer that restates the claim beside itself has
bought nothing, because the restatement is exactly the surface the pointer was supposed to remove."*
The passage restates clause 4's methodological caveat — not a fact about its own item — so a change
to clause 4's "four places"/"a fifth" wording leaves a stale copy here that no guard sees
("mutation site" is in no phrase family). It also sits against the `INVENTORY` reason's *"rather
than restating the clause"* (`retained_state_contract.rs:1089`). Source.

**[Low] `docs/decisions/2d-4a-notes.md:3191-3193` — "added three intra-doc links" is four.** The
hunk adds `enqueue`, `QUEUE_CAPACITY`, `evictable_sequence` **and**
`[`espansoconfig_core::watch::retained_state`]` — the only cross-crate link, i.e. the one the
`cargo doc` run was most worth doing for. Record only.

**[Low] `retained_state_contract.rs:1089` — the precedent is overstated.** *"exactly as this file's
`discards everything` entry does"*: that entry (`:1005`) reads *"the third way a stored entry
leaves"* and never names clause 4. Substantively the same form, so not worth a source edit — fixing
it would touch source and commission round 11.

### Not verified

- No `cargo`/`npm` gate run; all figures in §18.3 are the orchestrator's, not mine.
- My sweep replica is substring counting, not `prose_sweep::prose_units`; it cannot see unit
  segmentation, doc-attribute prose or non-comment string sweeping. It shows no count moved in the
  two changed files; it is not the guard.
- Whether the paragraph is *reachable* after the panic in a `panic=abort` profile, and Tauri's
  behaviour around the unwind — the paragraph disclaims both.
