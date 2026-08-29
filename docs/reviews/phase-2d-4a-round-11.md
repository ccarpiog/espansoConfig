Reviewer: autoclaude adversarial reviewer

# Phase 2d-4a-F — review round 11

Scope: commit `22d1afb`, the two comment hunks in `src-tauri/src/reconciliation.rs` and the
record that describes them (`2d-4a-notes.md` §19, §18.3's round-10 block). No `cargo`/`npm` run.

### High — `src-tauri/src/reconciliation.rs:1503` (source; M1's surviving clause)

*"the victim is whatever that rule names and never whichever entry this assertion trips over"*.
Read against the same paragraph, `:1509`: *"each waits on something outside this function: … an
overflow that **selects this entry**"*, and against the sentence's own condition at `:1500`:
*"costs the offending entry its place when [`evictable_sequence`] picks it"*. Both cannot be
true on the natural reading of *never* as an identity claim about the victim. `evictable_sequence`
(`:921-935`, `min_by_key(|(count, lowest)| (Reverse(*count), *lowest))`) is blind to which entry
tripped the assertion; the offending entry is an ordinary pending entry, and when its path holds
the most pending entries and it is that path's lowest sequence, the rule names **it** — which is
the only circumstance under which escape 2 is an escape at all. Under the literal reading the
escape can never fire and the closed list is three where the code has two: round 9's High from the
other side (`CLAUDE.md`'s own warning about an enumeration wrong by one). The intended reading —
*the rule never selects an entry **because** it tripped the assertion* — is available but is not
what the words say, and `retained_state_contract.rs:1089`'s `reason` states the opposite in as many
words: *"an overflow evicting **it** inside the enqueue"*. The pre-M1 text carried the same shape
with *not*; M1 deliberately kept and strengthened it (§19.1: *"keeps beside it only the fact this
passage needs"*), so it is this fix's. Fix in source ⇒ §7.1 commissions round 12.

### Medium — `2d-4a-notes.md` §19.1 closing paragraph (record)

*"still true, and more nearly true than before"* of `retained_state_contract.rs:1089`. M2's half of
that is right; the M1 half is not checked and is contradicted by the finding above — the `reason`
says the overflow evicts *it*, the edited comment says the victim is never *it*.

### Low — `2d-4a-notes.md` §18.3, round-10 correction block (record)

*"stated here of the paragraph as it now stands … the paragraph holds five link occurrences over
those four targets."* Counted: `ReconciliationQueue::enqueue`, `QUEUE_CAPACITY`,
`evictable_sequence`, `espansoconfig_core::watch::retained_state` ×2, `ReconciliationQueue::
begin_epoch` = **six occurrences over five targets**, which is §19.3's figure. The block's five is
true only of the four targets it just excluded `begin_epoch` from, while its preamble claims the
paragraph. §19.3 is right; §18.3 is mislabelled.

### Cleared by derivation, not accepted

Clause 5 (`retained_state.rs:112-118`) states the rule whole, tie-break included, and matches
`evictable_sequence` exactly — M1's pointer is accurate. Clause 4 (`:100-107`) satisfies all three
surviving claims, *what the count rests on* included, so M2's deletion kept nothing local. Header
quotes at `:55-61`/`:59-61` are correct. L2's argument holds: `:1005` names clause 4's third way by
its ordinal in clause 4's own words; twin at `:525`. `+9 / −9`, all `///`, and
`retained_state_contract.rs` unchanged — verified from `22d1afb`. No `RETAINED_STATE_SHAPES` or
`LIVENESS_SHAPES` phrase appears in the added or vanishes from the removed prose.

### Not verified

Gates (forbidden). The prose guard itself. §19.4's marks otherwise stand.
