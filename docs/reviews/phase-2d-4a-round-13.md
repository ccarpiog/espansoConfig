Reviewer: autoclaude adversarial reviewer

# Phase 2d-4a-H — review round 13

### Scope

`e334d5b`'s one source file (`reconciliation.rs`, +3/−4, comment-only), §21, and the three round-12
correction blocks. No `cargo`/`npm` run, per the brief.

### The count (§1) — clean

`:1491` declares three. Items: `after_sequence` (`:1495`), `enqueue` (`:1498`), `begin_epoch`
(`:1505`). Separators survive as *A; B; and C* — `:1497` *"…before the projection runs;"*, `:1505`
*"…the entry that trips here; and"*. The colon at `:1503` opens an explanatory clause **inside**
item 2 and the `:1505` semicolon closes it; item 3 is not swallowed.
Summary `:1507-1510` — *"a caller's watermark, an overflow that selects this entry, and a reopen"* —
matches the three **in order**, and *"an overflow that selects this entry"* is consistent with
`:1504-1505`'s *"never because it is the entry that trips here"* (which entry, not why). `:1512-1514`'s
attribution of the closure to clause 4 still holds: nothing in the paragraph argues the count.

### The appositive (§2) — clean

`"clause 5, a rule that does not know this assertion exists"` attaches by nearest-noun to *clause 5*,
the same referent as *"a rule about paths and their pending counts, stated whole as …"*
(`:1500-1502`); *"that rule"* (`:1503-1504`) resolves to it either way, so the demonstrative beats the
bare *"the rule"* it replaced. The claim is true:
`evictable_sequence` (`:921-935`, line numbers correct) reads only `pending`'s sequence keys and
`entry.observation.path()`; no `DocumentId`, no assertion state. Clause 5
(`retained_state.rs:112-118`) states the victim rule and mentions no assertion.

### Deleted and preserved clauses (§3, §4) — clean

*"waits on a state it cannot bring about"* is entailed by `:1508-1510`'s *"each waits on something
outside this function"* plus `:1508`'s *"nothing here prevents any of them"*. `drain` (`:1186-1189`)
raises `acknowledged`, then retains `*sequence > after_sequence` before the projection map; `after_sequence: u64` is unvalidated. `:1098` is `while guard.pending.len() > QUEUE_CAPACITY`.
`:1030` assigns `QueueState::empty(epoch)` over the whole state. The three `PoisonError::into_inner`
sites: `:1185`, `:1089`, `:1030`. Clause 4 (`retained_state.rs:100`) enumerates a stored entry's
exits. Ordinals right today.

### Findings

**M1 (Medium, record) — `docs/decisions/2d-4a-notes.md:3746-3748` and `:3846`.** The round-12
correction block replaces 83 with **85** and then re-endorses the per-file breakdown *"39, 18, 15, 4,
3, and one each in four more"*, saying **"it is exact"**; §21.1 repeats it as `39/18/15/4/3/1/1/1/1`.
That breakdown sums to **83** — it is the superseded `rg -c` line count. Re-derived,
`rg -o 'clause [0-9]' -c` over the same nine Rust files gives `retained_state_contract.rs` **41**
(not 39), 18, 15, 4, 3, 1, 1, 1, 1 = **85**. The block corrects the total to occurrences and keeps a
breakdown taken over lines: the "measure one span, label another" shape, standing inside the block
written to correct it. Its attribution *"is round 12's"* is also wrong — it is the line count quoted
from the bullet above.

**M2 (Medium, record) — `docs/decisions/2d-4a-notes.md:3861-3879` (§21.2).** *"Listed in full, this
record and the review files included"*. `git show e334d5b --numstat` gives **seven** files; §21.2
names four changed ones. Missing: `PROGRESS.md` (+150/−134),
`docs/progress-archive/next-action-history.md` (+110/−0), `docs/progress-archive/phase-2d.md`
(+54/−0). PROGRESS.md appears only in the commit message and in §21.4 as "next action".

No High. No source finding.

### Verified figures

`+3/−4` ✓; every added/removed line begins `///`, no executable line ✓; paragraph `:1481-1521`
**6 occurrences / 5 targets** ✓; doc comment `:1425-1521` **13 / 10** ✓; §21's `+4/−3` for `b854de5` ✓.

### Not verified

The **88 / 61 / 149** phrase figures: no recipe in the record reproduces them. `rg -c 'phrase: "'`
gives 141 and 86 entries; distinct single-line literals give 68 and 35. Multi-line literals are the
likely cause; unsettled inside budget. All gate numbers — the brief forbids running them.
