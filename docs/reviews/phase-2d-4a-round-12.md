Reviewer: autoclaude adversarial reviewer

# Phase 2d-4a-G — review round 12

### Verdict

`ship-with-fixes` — 0 High, 2 Medium, 3 Low. Two Mediums are record; two Lows are source.

### Findings

**[Medium] Record — `docs/decisions/2d-4a-notes.md:3216-3217`, the round-11 L1 correction block.**
It ends: *"Both numbers are re-derived here by listing every `` [`…`] `` in the doc comment rather
than by re-reading either claim."* Listing every link in the **doc comment** (`reconciliation.rs:1425-1522`)
yields **13 occurrences over 10 targets** — it adds `address_of`, `ObservedDocument`,
`ObservedDocument::Named` (×2), `ObservedDocument::Addressable`, `ReconciliationQueue::drain` and a
third `espansoconfig_core::watch::retained_state`. Six-over-five is right for the **paragraph**
(`:1481-1522`), which I re-derived and confirm. So the block names the wrong scope for its own
derivation — the exact defect it exists to correct in the round-10 block above it.

**[Medium] Record — §20.4 third item and §20.1's closing sentences: *"H1 is older than the fix under
review."*** Textually confirmed in `6572a29`: the pre-M1 clause read *"…and **not** whichever one this
assertion trips over"*. But the claim is incomplete where it matters. Pre-M1 the contrast term was a
**concrete criterion** — *"the victim is the lowest pending sequence of the path holding the most, so
it is that path's oldest pending entry that goes"* — under which *not whichever one* reads as
criterion-versus-criterion. `22d1afb` (M1) deleted that criterion, replaced it with the opaque
*"whatever that rule names"*, and strengthened *not* → *never*. M1 is therefore a contributing cause,
not merely a preserver. The record's flat *"this defect is older than M1"*, and the lesson drawn beside
it about rounds 9 and 10 reading past it, over-distribute the blame.

**[Low] Source — `src-tauri/src/reconciliation.rs:1504-1505`,** *"so this escape waits on a state it
cannot bring about"*. **it** has three candidate antecedents (this escape, that rule, the offending
entry). Under the likely one it is near-tautologous, and it partly duplicates the paragraph's own
summary four lines below — *"each waits on something outside this function"* (`:1509-1510`).

**[Low] Source — `src-tauri/src/reconciliation.rs:1502-1506`, punctuation of a three-item list.** The
new full stop after *clause 5* ends list item 2; item 3's *"; and [`ReconciliationQueue::begin_epoch`]"*
now hangs off a sentence whose subject is item 2's rule. Recoverable, but both Highs of this tail
(rounds 9 and 11) were enumeration miscounts in this paragraph.

**[Low] Record — §20.4, *"nine files and 83 citations"*.** `rg -c` counts matching **lines**;
`rg -o 'clause [0-9]' … | wc -l` gives **85** over the same nine files, whose per-file breakdown
(39/18/15/4/3/1/1/1/1) I confirm exactly. The conclusion beside it is sound: every citation I sampled
targets `retained_state`'s list, and the links resolve to the module, so a renumbering breaks nothing.

### Cleared by derivation

- The repaired sentence is **true of `evictable_sequence` (`:921-935`)**: it is a pure function of
  `pending` over paths, counts and sequences (`min_by_key(|(count, lowest)| (Reverse(*count), *lowest))`),
  reads no `DocumentId` and no assertion state. *"Never because it is the entry that trips here"*,
  *"when [`evictable_sequence`] picks it"*, *"an overflow that selects this entry"* and
  `retained_state_contract.rs:1089`'s *"an overflow evicting **it** inside the enqueue"* are now all
  true together. No coupling, direct or indirect.
- *Point, do not restate* (`retained_state.rs:55-61`) is honoured: the added prose makes a negative
  claim about **this** escape and reinstates none of M1's deleted paraphrase of clause 5.
- Preserved clauses checked, not assumed: `drain` (`:1185-1189`) raises `acknowledged`, retains
  `*sequence > after_sequence`, then projects — so the watermark escape and the poisoning claim hold;
  `enqueue` evicts on `while guard.pending.len() > QUEUE_CAPACITY` (`:1098`); `drain`, `enqueue` and
  `begin_epoch` each use `PoisonError::into_inner` (`:1185`, `:1089`, `:1030`).
- §20.2 verified: `+4 / −3` by `--numstat`; every added and removed line begins `///`; the link set
  unchanged; paragraph six over five.
- **L2**: I agree it stays declined — `:1005`'s *"the third way a stored entry leaves"* is clause 4's
  own words, which is what the precedent at `:1089` claims.

### NOT-VERIFIED

- Every gate (`cargo test/clippy/fmt/doc/tree`, `npm check/test/build`): the brief forbids running
  them, so I report none. A green suite is no evidence about a comment.
- *"No inventoried count moved"* (§20.3) and the 88/61 phrase families against the diff — not walked
  within budget; the reviewed prose contains no phrase I recognised from the entries I read, which is
  weaker than the check the record describes.
- §20.4's `docs/reviews/phase-2d-4a-queue.md` item and R9's status.
