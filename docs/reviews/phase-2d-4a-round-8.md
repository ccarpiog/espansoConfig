Reviewer: adversarial Opus fallback — Codex unavailable (usage limit, resets 19:07)

### Verdict

NOT READY — 0 High, 1 Medium, 2 Low; every finding is prose in a source file or the record, none is
a behaviour defect, and the fix round's central claim (no executable line changed) is verified true.

### High

None. Every added/removed line under `src-tauri/src/` is a `//`, `///` or `//!` line — checked
mechanically by stripping `+`/`-` and leading whitespace from `git diff -U0` and finding no residue.
No test, fixture, phrase table or inventory entry moved. §16.3 records every gate as `pending` with
no measured number anywhere in the table; the only numbers it reports are labelled a Python replica,
and the paragraph beneath says in as many words *"It is a replica and not the test"*, names the two
real guards, and says the replica "can agree with a wrong implementation of itself". That is honest.

### Medium

1. **M1's replacement paragraph denies two escapes the code allows.**
   `src-tauri/src/reconciliation.rs:1489-1493` states *"a later drain at any watermark below the
   offending entry's sequence reaches this assertion again — and the caller cannot acknowledge past a
   sequence it was never handed"*, under the heading *"What that does not buy is a queue this caller
   can drain."* Both sentences claim an enforcement the code does not have.
   - `after_sequence` is an unvalidated `u64` off the wire (`commands.rs:3491-3495` →
     `commands.rs:1353-1359` → `reconciliation.rs:1184`). Nothing checks it against anything handed
     out; a caller passing any value above the offending sequence has the entry pruned by the
     `retain` at `:1187` before the projection, and drains cleanly.
   - `ReconciliationQueue::begin_epoch` (`:1029-1031`) assigns `QueueState::empty(epoch)` over the
     whole state, so reopening the workspace discards the offending entry outright.

   Failure state: a reader follows this paragraph, believes the queue is wedged for the epoch, and
   reasons about recovery from a premise the code contradicts twice. It errs pessimistic, so nothing
   unsafe follows from it — but the paragraph exists precisely to stop a sentence that does not reach
   its conclusion, and this is one, three lines below the assertion it is about. §16.1's M1 row and
   its first disagreement bullet repeat it (*"the caller cannot acknowledge past the offending entry
   because it was never handed its sequence"*), so the fix is at three positions.

   The rest of the paragraph is **true and I verified it line by line**: `guard.acknowledged = …`
   (`:1186`) and `pending.retain` (`:1187-1189`) both complete before `coalesced_sequences` and
   before the `.map(external_observation)` inside the `.collect()` (`:1191-1197`) that reaches
   `external_observation:1307` → `address_of_minted:1500`. `discarded` and `epoch` are untouched by
   `drain`, so the surviving state is exactly what a completed `drain(after_sequence)` leaves.

### Low

1. **Two record sentences mis-describe the direction of the review's span errors.**
   `docs/decisions/2d-4a-notes.md` §15.2's round-7 correction and §16.1 say the corrected spans are
   *"each a line wider at one end than the review's"* and that the review's are *"each a line short
   at one end"*. Measured on `93fb76b`: the first block is `1771-1774` against the review's
   `1770-1774` — a line **narrower**, not wider; the second is `1794-1802` against `1794-1801` — a
   line wider. Both spans themselves are correct; the characterisation of one of them is not.

2. **"Fifteen positions" counts three pointers as statements of the claim.** The same correction
   block says three of the nine *"now point at it rather than restating it"*, then calls
   `retained_state`'s clause 6 a *"fifteenth"* — 14+1 only if the three pointers still count.
   §16.4's second bullet then calls it *"the fifteen-position epoch-scoped watermark family"* whose
   positions are *"kept identical by a reader"*, which is not what a pointer is. The block hedges
   ("re-derive the positions from the tree"), so the harm is bounded.

### Verified without findings

- **Verbatim reproduction is exact.** `docs/reviews/phase-2d-4a-queue.md`'s appended block, from its
  `Reviewer:` line onward, is byte-identical to `docs/reviews/phase-2d-4a-round-7.md` after `### `→
  `## ` demotion — 97 lines against 97, zero diff hunks.
- **L4's "six positions" is right.** `reconciliation.rs:102-106`, `:1158`, `:1842`, `commands.rs:1324`,
  `:3474`, `:8839` — all six now carry both qualifications.
- **L1's four positions**: source at `reconciliation.rs:2704`, record at §3.3 (`:812`), §15.1
  (`:2317`) and §15.4 (`:2518`). The uncorrected `:2016` is inside a `>` quote of an earlier round and
  correctly left.
- **§16.2's by-file list matches `git diff --stat`**: 7 files, 3 comment blocks in `reconciliation.rs`,
  1 in `commands.rs`, and it names `phase-2d-4a-round-7.md` as the untracked eighth path.
- **§16.4's marks are honest.** Nothing marked *recorded only* names a source defect; the three
  *actionable* items name a re-runnable check, a deliberately-left assertion message and six `docs/`
  positions — none a correctness defect in source, so none is a blocker.
- `retained_state_contract.rs:106-116`'s `src/` clause takes no decision and states the gap.

### Questions

- Does `SWEPT_TREES` excluding `src/` deserve a 2d-4b acceptance criterion rather than a sentence?

### Not verified

- Any gate: forbidden to run `cargo`/`npm`.
- The five provenance attributions in §16.1's L2 bullet (`eced554` / `6be7231`) — the five positions
  exist and their text matches, but I did not run `git log -S` on each to confirm which commit
  introduced which. §16.4 already nominates this as thin.
- The replica's 88/140/224/0 and 61/86/129/0 counts, which need execution.
