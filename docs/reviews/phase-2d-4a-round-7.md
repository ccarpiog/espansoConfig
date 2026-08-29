Reviewer: adversarial Opus fallback — Codex unavailable (usage limit, resets 19:07)

### Verdict

NOT READY — 0 High, 1 Medium, 4 Low; every finding is prose in a source file, none is a behaviour
defect. **(a), narrowly**: each names a specific false sentence or unstated hole, so none is a bare
restatement — but four of five sit in sites §15.4 or the brief had already nominated, and round 6
changed code twice where round 7 finds nothing that would.

### High

None.

### Medium

1. **The panic policy borrows a justification that is false of one of the two mutexes it covers.**
   `src-tauri/src/reconciliation.rs:1469` says *"`crate::commands`'s module header is why the two
   poisoned mutexes are not a second failure"*. That header (`commands.rs:220-228`) grounds
   absorption in three properties of the session mutex: behind it sits **a cache over the disk**,
   **every mutation is a single infallible assignment**, and **the recovery is `reload_document`**.
   None holds of `QueueState`: nothing can re-read lost observations; `drain` mutates it with
   **two** statements — `acknowledged` (`:1186`) then `retain` (`:1187-1189`) — before reaching the
   `assert_eq!` at `:1480`; and no `reload_document` recovers a queue.

   Failure state: the assertion fires mid-`collect`, both locks are poisoned and absorbed, and the
   queue is left with `acknowledged` raised and the prefix pruned while the caller got no batch.
   The conclusion happens to hold — both mutations are pure functions of `after_sequence`, so the
   surviving state is consistent and a retry with the same watermark reproduces the batch — but
   **that reason is stated nowhere** and the one stated does not apply. §15.4 called this prose thin
   for a different reason (the unmeasured runtime).

### Low

1. **Two positions in one file contradict each other about the same arm.**
   `reconciliation.rs:1459` says the `Addressable` arm carrying the workspace's number *"was
   locally true and the object held two identities for one file"*. The new test's comment,
   `reconciliation.rs:2677`, says *"There is no arm of `ObservedDocument` that is true in that
   case"*; §15.1's L1 row repeats the second. The first is right — `Addressable { resolved }` is
   true of what it carries; what is false is the **observation**, whose projection carries the
   snapshot's id.

2. **"Nine source positions" is at least eleven, and the two omitted are wording, not assertions.**
   §15.2 files `adopting_an_epoch_discards_the_previous_ones_entries_and_its_losses` under *gained
   two assertions*, but it also gained two prose blocks stating the claim,
   `reconciliation.rs:1770-1774` and `:1794-1801`. Both are correct — but §15.4 sends round 8 to
   §15.2's list of nine, and these are not on it.

3. **`prose_sweep` joins wrapped comments but not wrapped string literals, and neither guard states
   it.** `prose_sweep.rs:125` frames per-line handling of non-comment lines as a benefit. But this
   repository hand-wraps assertion messages with backslash continuations (e.g.
   `reconciliation.rs:1786`), and a claim split across such a break matches nothing — exactly as a
   wrapped comment would have. `retained_state_contract.rs:58` claims the check "catches an
   *unmarked* claim and a *new* claim"; its four stated limits omit this one. Re-running the
   sweep's algorithm over a continuation-joined copy of both trees for all 88 phrases finds **zero**
   hidden positions today, so this is a hole in stated capability, not a live miss.

4. **A fifth "same batch twice" position carries neither qualification.** `commands.rs:8838`: *"the
   same call answers the same batch until the caller says it has one of them."* The four others
   (`reconciliation.rs:102`, `:1157`, `commands.rs:1324`, `:3474`) all carry *when nothing was
   enqueued between the two calls and no replacement epoch was adopted between them*.

### Verified without findings

- Within-epoch monotonicity is real, not merely documented: `acknowledged` only rises
  (`reconciliation.rs:1186`), `newest_sequence` is `max(batch high, acknowledged)` (`:1207-1211`),
  and an eviction only accompanies a higher-sequence admission. The nine enumerated positions agree
  and none is over-narrow.
- `evictable_sequence` (`reconciliation.rs:920-935`) matches its doc and clause 5:
  `min_by_key((Reverse(count), lowest))`. R10's narrowed closure and its tie sentence are accurate.
- "Same batch twice" survives drain-time projection: `entries` is written only by `from_tree`
  (`crates/espansoconfig-core/src/workspace/mod.rs:483-496`) and `open` mints a new `Workspace`
  with a new epoch, so `address_of` is constant within an epoch.
- Lock extent is as documented: `with_workspace_read` (`commands.rs:1446-1455`) holds only the
  session mutex, `drain` the queue mutex under it, and the identity register
  (`workspace/mod.rs:313-329`) is released before the assertion.
- `complaints_against` (`prose_sweep.rs:326-403`) is sound both ways; its three inventory
  pre-checks are unconditional.
- Every arm of `ObservedDocument`, `AddedContent` and `ChangedContent` is serialized in
  `every_observation_crosses_as_a_uniform_object_and_carries_no_anchor`, so no second wire enum
  repeats the coverage-versus-argument gap.

### Questions

- Should `src/` join `SWEPT_TREES`? 2d-4b will write TypeScript storing `newest_sequence`;
  `retained_state_contract.rs` explains why `docs/` is excluded and says nothing about the frontend
  tree, so its limits list reads exhaustive and is not.
- §7.1: all five are fixed by editing comments in source files, so **any fix commissions round 8**.
  To stop, the cheapest honest close is to fix none and carry all five as recorded items.

### Not verified

- What a panic inside a Tauri command does to the process or the webview — unchanged from §15.4.
- R9's identity register — unmeasured for a third round, and unmeasurable from a test in this
  binary because the register is a process-wide static.
- The R10 tie case: confirmed by reading `min_by_key`, not by execution.
- Anything needing `cargo` or `npm` — the caller's gates were taken as given.
