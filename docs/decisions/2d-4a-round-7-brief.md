# Phase 2d-4a — the round-7 review brief

_Extracted verbatim from `PROGRESS.md`'s "Next action" section on 2026-08-29, when the
checkpoint was split. This is live specification: round 7 runs against both the round-6
fix and the mechanism 2d-4a-C built. Deferred by owner decision on 2026-08-27; the
deferral has since expired, because 2d-4a-C is closed._

---

### ⏸️ DEFERRED BY OWNER DECISION (2026-08-27) — the round-7 brief, preserved verbatim. Round 7 runs **after** Phase 2d-4a-C, and reviews the mechanism as well as the round-6 fix. Everything below is still its spec; only its timing changed. (Its "standing question for the owner" **has now been answered** — the mechanism is being built first.)

**Read `docs/reviews/phase-2d-4a-queue.md` first — it is the work list.** Rounds 1 through 6 are in
it verbatim, newest last, each with the host-measured evidence its brief carried. Round 7's brief is
written from round 6's fix, exactly as round 6's was written from round 5's.

**Round 6 did not end the tail, and it was given the chance to.** Its brief carried the owner's
standing instruction verbatim — *if everything you find is a restatement of the retention-boundary
wording with no new substance, say so in the verdict*. It did not say so. It **cleared** the twelve
retention positions and the fifth-mutation question outright, then found round 5's own lesson one
level up on the **watermark**. **Six rounds, and each one has found a real defect in what the round
before built.** Round 7's brief must be written the same way: ask what the round-6 fix's own new code
and its own new sentences now rest on.

#### What the round-6 fix built — re-derive these, do not inherit them

Round 6 was **NOT READY — 0 High, 1 Medium, 5 Low**. Two findings changed code, three changed words,
one changed nothing by design. `docs/decisions/2d-4a-notes.md` **§15** is the record; **§15.4 is
where it says what it is thin about, and reading that first is the cheapest way to write round 7's
brief.**

- **The watermark claim is epoch-scoped at nine source positions.** *Within the epoch the batch
  names*, `newest_sequence` never falls below the highest watermark this queue has been drained with
  under that epoch, so a caller showing that epoch stores it unconditionally, out-of-order drains
  included; **across a replacement epoch it falls**, which is not a walk-back, and
  `ReconciliationBatch::epoch` separates the two numbers. The review named four positions; the fix
  round's sweep found nine, two of them in `dispatch_check.rs`, which the review never opened.
  **Round 7 should ask whether the nine agree with each other and with the code, and whether any is
  false in the other direction** — and whether there is a tenth. This is a **new claim at nine
  positions**, which is precisely the shape every prior fix left a narrower instance of.
- **`address_of_minted`'s agreement is an `assert_eq!` on every profile.** A disagreement is a
  failure, never a wire value, because no `ObservedDocument` arm is true in that case. **The panic
  policy is argued, not measured**: §15.4 concedes nothing in this repository says what a panic
  inside a Tauri command does to the process, and the new test proves the *function* fails, not that
  the app survives. **Judge whether a panic is the right shape**, and whether the poison argument
  (`PoisonError::into_inner` at every lock) covers every lock a panicking `drain_external_changes`
  actually holds. The orchestrator verified the poison claim by reading every `lock()` in both files;
  round 7 should verify the **process** claim, which nobody has.
- **All six `UnreadableReason` arms are serialized and a seventh is a compile error.** Four read
  failures were added; `wire_tag`'s exhaustive `match` is what forces the decision. Ask whether the
  same coverage-versus-argument gap exists anywhere else on this wire — the nested content enums were
  round 5's instance and this was round 6's.
- **R10's recorded closure was narrowed to the implemented rule** — a path with one pending entry is
  never the victim while another path has two — and the tie case is stated. **No code changed and no
  test was added for the tie case**, which §15.4 carries as thin.
- **R9 is open, unmeasured and unbounded**, unchanged and recorded for the second round running.
- **§15.2 lists all six files this round touched**, the review queue and the record included, which
  is L5's own lesson applied to the section that failed it.

#### What round 7 must attack

- **The fix is a change, and the round that reviews it is not optional.** Round 7's scope is the
  round-6 fix: the nine epoch-scoped watermark positions, the `assert_eq!` and its panic policy, the
  six-arm `UnreadableReason` walk and its compile-error claim, R10's narrowed sentence, the R9
  verdict, and §15's seven correction blocks.
- **Apply round 6's own lesson to round 6.** Round 6 found a rule written from the thing's own
  properties and made false by a session-level replacement — the second such finding in two rounds,
  after the retention boundary. **Ask what else is described without its epoch**: `discarded` and the
  loss count, the wake's payload, `ReconciliationWake::newest_sequence`, the ledger's sequence
  allocator, and anything in `dispatch_check.rs`, which no round before 6 had swept at all.
- **The most likely place is the sentence directly above the one a future round quotes.** §15.4 says
  it, as §14.4 did.
- **The residues.** R9 is **open** by two rounds' verdicts. R3 was cleared by rounds 5 and 6. R10 is
  bounded by the narrow rule, its false closure now corrected, and its tie case untested. This
  project's precedent: **seven** items recorded as bounded residues in Phase 2d-3 were later found to
  be real defects.

#### The gate baseline — all measured on this tree by the orchestrator, not accepted from a report

- **`1309 / 431 / 2125 / 184`** (`cargo test --workspace` / `npm run check` files / `npm test` /
  `npm run build` modules). The Rust ladder across this step: **1272** at 2d-3-C, **1297** at the
  implementation, **1301** / **1303** / **1307** / **1308** / **1308** after fix rounds 1–5, and
  **1309** after fix round 6 (**+1** — L1's `#[should_panic]` test, the only one added; L2 extended
  an existing test). 26 result lines, all `ok`, 0 failed, exit 0.
- `cargo clippy --workspace --all-targets -- -D warnings` clean; `cargo fmt --check` clean;
  `cargo doc --workspace --no-deps` exit 0 with **73** `private_intra_doc_links` warnings, the
  pre-existing count; `cargo tree -p espansoconfig-core | rg tauri` **empty**.
- `cargo test -p espansoconfig --bin espansoconfig watch_check:: -- --test-threads=1` **20/20** with
  **264** filtered out (223 → 227 → 252 → 256 → 258 → 262 → 263 → 263 → 264 across the step),
  70.73 s. **Its wall-clock is not a baseline**; what it asserts is 20/20 and no timeout.
- The production-bundle oracles: `$$payload|head_payload|push_element` **absent**,
  `window.__svelte|svelte-trusted-html` **present** with 2 matches.
- **The host scar still binds.** Kill orphans (`pkill -f 'target/debug/deps/espansoconfig-'`), run the
  workspace suite **once**, and stay off the machine. The fix round saw 10 `watch_check::`
  baseline-scan timeouts on a host that had just built; a re-run and the single-threaded gate were
  both clean. That is the scar, not a regression.
- **On a tree with unstaged work, `git checkout <path>` is not an undo.** Revert a probe with the
  inverse edit — the fix round ran three probes and reverted all three that way.

#### Read these first, in this order

```sh
cd /Users/ccarpio/Developer/espansoConfig
git status --short --untracked-files=all     # expect EMPTY after this checkpoint's commit
# docs/reviews/phase-2d-4a-queue.md          # THE WORK LIST — rounds 1–6 verbatim
# docs/decisions/2d-4a-notes.md              # the record; §15 is the round-6 fix and §15.4 what it
#   is thin about, §14 the round-5 fix round 6 reviewed, §2.2 the eviction policy, §3.2 the
#   AddedContent/ChangedContent wire, §3.3 ObservedDocument, §9 R3/R9/R10
# docs/decisions/2d-4-split-notes.md         # why 2d-4 is two steps and what 4b owes
# docs/reviews/phase-2d-design.md            # THE AUTHORITY for 2d. Q3 the wire, Q5 the coalescing
#   rule, Q7 item 4 the scope and its prohibitions, Q7 item 5 the out-of-order drains 2d-5 performs,
#   Q8 the sharpest failure mode
# src-tauri/src/reconciliation.rs            # the whole step
# src-tauri/src/dispatch_check.rs            # swept for the first time at round 6 — two M1 positions
# crates/espansoconfig-core/src/workspace/mod.rs  # identity_of and identity_already_issued
# crates/espansoconfig-core/src/watch/liveness.rs # THE CONTRACT. Read before writing any sentence
#   about what the pipeline guarantees, and point at it rather than restating it
```

#### A standing question for the owner — sharper after round 6, and now about a family rather than a sentence

Phase 2d-3's tail ran to **fourteen** rounds and was ended by owner decision, which commissioned
2d-3-C to build the convergence mechanism rather than run a fifteenth. **This tail is at six.** The
stopping rule as written — *stop when the findings are only restatements of the retention sentence* —
**did not trigger, correctly**: round 6 cleared retention outright and found a different subject.

But the deeper pattern did not break, and it is worth putting plainly. **§14.4 named the gaps, and
four of round 6's six findings landed in exactly the gaps it named.** The same was true of §13.4
before it. The record is now reliably predicting its own next round's findings, which means the
remaining defects are not being *hidden* — they are being *listed and left*. Two rounds have also now
found the same failure shape, *a rule stated without the epoch that scopes it*: round 5 on retention,
round 6 on the watermark.

**So the analogue of 2d-3-C here is not a retention-boundary checker.** It is a check over the family
of claims of the form *how long does X survive, and under what scope* — the way
`liveness_contract.rs` covers the liveness family: an inventory of the scoped claims, a phrase set,
and a build failure on an unmarked or new one. §15.4 names the absence. **The owner's call is whether
round 7 runs first or the mechanism is built first**; the orchestrator did not decide it unilaterally,
and the tail is currently continuing on the evidence that every round is still finding real defects.

#### After the review closes: 2d-4b

`docs/decisions/2d-4-split-notes.md` §2 is the spec. The TypeScript half: the mirrored types
(**including `AddedContent` and `ChangedContent`**), the `BrowserCommands` wrapper for the drain, the
**injectable** event-listener wrapper, the `describe*` builders in `src/lib/i18n/codes.ts` and their
reactive `t*` wrappers in `index.ts`, the frontend tests, and the **re-measured** `npm run check` /
`npm test` / `npm run build` baselines.

Four things 2d-4b inherits, stated so they are not rediscovered:

- **`AWAITING_FRONTEND_DECLARATION` in `wire_contract.rs` must be deleted by 2d-4b.** It is the
  one-entry gap the split opened, checked in **both** directions — declaring the command name on the
  frontend without deleting the entry fails the build.
- **`src/lib/i18n/codes.test.ts:379` holds variant counts** that the new EN/ES keys do not yet appear
  in, because no accessor exists. Adding the accessors moves those counts.
- **A key with no accessor is a key nothing can render.** 2d-4a's frontend gate is green with the keys
  present and unreachable; that is a fact about the present suites, not a licence.
- **`ObservedDocument` has three arms and no accessor over them, deliberately.** 2d-4b must match on
  the arm rather than reach for the identity where there is one — `Addressable` and `Named` differ in
  whether the open workspace will accept the number, and collapsing them with a `?` reintroduces
  round 4's M1 in TypeScript with every Rust gate green.

---


