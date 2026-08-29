Reviewer: autoclaude adversarial reviewer

# Phase 2d-4a-D — review round 9

Scope: the round-8 fix only. No gate was run (the brief forbids it); nothing was edited but this
file.

### High — the closed enumeration is wrong by one

`reconciliation.rs:1491` — *"**Two things end that loop and neither is an enforcement this code
performs**"*, then names the unvalidated watermark and `begin_epoch`. **There is a third, and this
repository states it in three places.** `enqueue` at `:1098-1104` evicts while
`guard.pending.len() > QUEUE_CAPACITY` (256, `:255`), and `evictable_sequence` (`:921-935`) takes
the lowest sequence of the busiest path — which is the offending entry once its own path keeps
arriving. `retained_state.rs` clause 4 says it outright — *"A stored queue entry leaves in exactly
three ways … a later drain acknowledges it, **an overflow evicts it**, or the queue adopts a
replacement epoch"* — and `commands.rs:3477` names it too. Eviction is an escape, not a repair, touches no disagreement,
and is not prevented here — so it belongs on the paragraph's own terms. Round 5 found this shape in
this file. **The same defect is inherited verbatim** by
`retained_state_contract.rs:1089` (*"the two escapes from `address_of_minted`'s repeating
assertion"*) and by `2d-4a-notes.md:2951`.

### High — the `INVENTORY` reason cites the wrong clause, and its precedent says so

`retained_state_contract.rs:1089`: *"The second cites clause 6's consequence on one path … exactly as
this file's `discards everything` entry does"*. Clause 6 is *"Within the epoch a batch names, its
`newest_sequence` never falls"* — nothing in the M1 paragraph is about `newest_sequence`. What the
`begin_epoch` half states is clause 4's third way (scope: clause 2). The cited precedent contradicts it: `retained_state_contract.rs:1005` reads *"`begin_epoch`'s own summary — **the
third way a stored entry leaves**"*, and its core-side twin at `:525` reads *"clause 4's third way"*.
Repeated in the record at `2d-4a-notes.md:2951-2953`. The recorded coupling is therefore wrong: a change to clause 4 — the clause
this comment depends on, and the one my first finding touches — traces to nothing. `count: 1` and the **local fact** cell are both right ("things end"
appears once in that file, `:1491`).

### Medium — §17's record of its own scope

- `2d-4a-notes.md:2904` — *"This is the round's only source change"*, contradicted by §17.2's two-file
  list and by `:2956` (*"That entry is a second source change"*). One sentence has to go.
- `:2977` — *"The unreviewed change is one comment hunk that removes a claim rather than adding one"*,
  written to size the corrective phase. It understates twice: the unreviewed change is a comment hunk
  **and** a `const` array item, and the hunk is net +30 lines that **adds** two factual claims.
- `:2985` — *"The fix made the paragraph say less, which is why it is safe without a test."* It traded
  one enforcement claim for two unasserted assertions about `drain` and `begin_epoch`, inside a closed
  count that is wrong. Not "less".

Verified, not findings: both named escapes hold (`after_sequence` is an unvalidated `u64` at
`commands.rs:3491` → `:1355` → `reconciliation.rs:1184`; the retain at `:1187-1189` precedes the
projection at `:1191-1197`; `begin_epoch` at `:1029-1031` assigns a whole fresh state).
"No executable line changed" is true of the `reconciliation.rs` hunk and **false** of the
`INVENTORY` entry — §17 scopes that claim to round 7's fix, so it is not a defect.

### Not verified

Every gate (forbidden by the brief); the guard's behaviour on the new prose, so I cannot confirm no
other inventoried count moved — only that no `PHRASES` entry I spot-checked matches the added text. Round 8's fix cannot be isolated by `git diff`: it shares commit `125dfa8` with round
7's, so the pre-fix M1 wording was taken from the record. Third consecutive Opus round of this tail,
per the brief's own note.
