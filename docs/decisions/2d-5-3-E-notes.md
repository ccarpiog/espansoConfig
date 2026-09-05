# Phase 2d-5-3-E — the round §7.1 commissioned for 2d-5-3-D's fix

**Risk class high; worker model `opus`.** No implementation worker: the phase's product is a review
and its fix, both taken by the orchestrator. Review:
[`docs/reviews/phase-2d-5-3-E.md`](../reviews/phase-2d-5-3-E.md). Verdict **`ship-with-fixes`, 0
blockers**, 2 Medium and 0 Low. **Both were re-derived by the orchestrator against the code before any
fix was applied**, both hold, and both are fixed.

2d-5-3-D's Next-action prose — **115 lines** — is archived in
[`next-action-history.md`](../progress-archive/next-action-history.md) under *"archived 2026-09-05 at
Phase 2d-5-3-E"*, with the two claims this round corrected marked **at the top of the archived copy**
rather than after it — 2d-5-2b-C's precedent.

**Scope.** §7.1 commissioned this round for 2d-5-3-D's fix and for nothing else: the two rewritten
comments in `src/lib/browser/reconciliationCoordinator.ts` — `runOneDrain()`'s `staleOpen` arm and its
`awaitingReady()` arm — and `docs/decisions/2d-5-3-D-notes.md` with the correction blocks it added
elsewhere. The brief said in as many words: **check the comments against the code, not the code against
the comments.** That is what found both Mediums.

**Both findings are claims 2d-5-3-D's own fix introduced.** This is the **fourth consecutive round of
this chain whose entire finding list is its predecessor's fix**, and the fifth round of the tail. That
is not a complaint about the previous round: it is the mechanism §7.1 exists for, working.

---

## 1. Medium 1 — the replacement for a false *coverage* claim is a false *absence* claim

**What the comment said**, written by 2d-5-3-D to replace a citation naming a test that drove nothing:

> **Nothing in this repository drives the third state, and nothing here could.** … So an edit to that
> early return falsifies this paragraph with every gate in the project green.

**What the code gives.** `src-tauri/src/watch_check.rs`'s
`a_failed_reopen_keeps_the_previous_watcher_watching` — read in full before the finding was accepted —
does all of this against a real filesystem tree:

1. opens the tree and waits for the watcher's baseline scan (`epoch 1`, ready);
2. refuses a **second** open with `dir.path().join("does-not-exist")`, asserting `is_err()` — the
   `CommandError::NotADirectory` arm, which is precisely the `Workspace::discover(root)?` early return
   the comment is about;
3. asserts `session.watch_status().expect("the workspace stayed open")` — **the previous workspace is
   still installed**;
4. asserts `status.epoch == 1` with the message *"a failed open must not replace the watcher"*, and
   `status.ready`;
5. writes a real edit to `match/base.yml` and asserts the observation arrives **at epoch 1**.

That is the third state's **workspace half**, driven and asserted. `src-tauri/src/main.rs` declares
`mod watch_check;` under `#[cfg(test)]` with **no `#[ignore]` and no feature gate**, so the test runs in
the ordinary `cargo test --workspace` gate — it is among the 1320. A change letting a refused open
replace or empty the session turns it **red**, so the *"every gate in the project green"* clause is
false with it.

**What is genuinely unpinned is narrower: the queue half.** That test never drains. Nothing anywhere
asserts that the reconciliation queue's stored entries survive a refused open — which is the half this
arm actually rests on, because what the arm needs is that the batch's `newest_sequence` still indexes
the queue Rust is holding. The comment now says exactly that, and no more.

**The shape matters more than the instance.** A round traded an overclaim about *coverage* for an
overclaim about *absence*. An absence claim reads as humility — it appears to be the careful,
self-limiting thing to write — and it is exactly as unchecked as the citation it replaced, with the
added property that **no reader is prompted to go and look**, because there is nothing named to check.
`CLAUDE.md`'s worst-defect class is a record claiming a guarantee the code does not give; this is its
mirror image, and it belongs in the same class.

## 2. Medium 2 — the case correctly removed from the third state was attributed to the wrong one of the other two

**What the comment said**, written by 2d-5-3-D to close its own Medium 1:

> reaching a `list_documents` refusal at all means `open_workspace` **succeeded** — the swap block
> already ran … **which is the incoming-lifecycle case above** with its queue reset to empty, not this
> one.

**What the code gives.** The premise is right and the conclusion does not follow from it.

- The arm above separates its **first two** states by the **lock race**: *"win, and the batch is the
  outgoing queue; lose, and `open`'s swap block has already run."*
- `WorkspaceSession::drain_external_changes` reaches the session mutex through `with_workspace_read`,
  which takes `self.lock()` for the whole closure. `WorkspaceSession::open` takes the same lock for its
  swap block. Both are synchronous — `rg 'pub async fn' src-tauri/src/commands.rs` returns nothing — so
  they are serialized by the dispatcher and each runs wholly before or wholly after the other.
- A refused `list_documents` is observed in `./workspace.svelte.ts` **after** `open_workspace` returned
  successfully. That fixes when the *swap* happened relative to the *`list_documents` call*. It says
  nothing about when the **in-flight drain** was serviced, and the drain's JavaScript `await` can stay
  pending long after its Rust call completed.

So the batch may be the outgoing queue (state 1) or the incoming one (state 2). **It is one of the
first two, whichever the race gave.** The correction the round got right — that this is not the third
state — stands; the attribution on top of it does not.

**Why this one was easy to write and hard to see.** The sentence chains two true facts (`!opened.ok`
returns first; the swap ran) and lands on a third that is about a *different clock*. Re-deriving the
premise confirms the premise, which is why re-reading the sentence never catches it and only asking
*"what decides which state the batch is in?"* does.

## 3. What was checked and left standing

Each re-derived by the orchestrator, not accepted from the review:

- **`awaitingReady()`'s new premise is true at its arm.** The arm is reached only when
  `openedAt === host.openGeneration()`, because the arm above returns for the case where the generation
  moved. Its premise — that what is unknown is whether the announced open has replaced this session
  *yet* — is a statement about the gate, not about the generation, and it does not contradict the arm's
  opening sentence.
- **`Workspace::discover(root)?` is outside the lock** (`commands.rs:683`, before `self.lock()`), and
  `open`'s own doc comment says *"A failure leaves the previously open workspace in place"* in as many
  words — so 2d-5-3-D's citation of it is accurate.
- **`ledger.begin_epoch`, `reconciliation.begin_epoch` and `guard.replace(Open { .. })` are one
  session-lock block**, and `guard.replace` is that slot's only writer.
- **`workspace.test.ts`'s failed-open case pins the *gate*.** It holds `drainSequences` at `[0]` across
  the refused open and a later wake, so no batch reaches the arm in it. Everything 2d-5-3-D said about
  that case is correct.
- **No `pub async fn` in `commands.rs`**, so 2d-5-3-D's Low — that the "blocked on the session mutex"
  wording named a two-thread race that cannot occur — is itself sound, and the two source comments it
  checked and left claim only an *order*, which dispatcher serialization gives.

**2d-5-3-D's thin item 4 is closed by measurement.** It worried that the five positions citing a
comment by its opening words or a function by symbol might have been broken by that round's own
rewording of two anchored comments. All five were resolved and **all five still match**. The class is
not closed — see §8 — but this instance of it is.

## 4. The sweep, and what it refused to touch

`rg` for both shapes rather than for either finding's words — `incoming-lifecycle|incoming lifecycle`
and `nothing drives|drives the third state|nothing in this repository drives` — over the whole tree
excluding `node_modules` and `target`. Five record positions carried one or both, and all five are
corrected **as corrections rather than as rewrites**, because the rounds that wrote them recorded what
they had established at the time:

| Position | How it was answered |
|---|---|
| `docs/decisions/2d-5-3-D-notes.md` §1/§3 | a correction block at the **top** of the file, before its scope statement |
| `docs/decisions/2d-5-3-C-notes.md` §1 | a nested *"correction to the correction"* appended to 2d-5-3-D's own block there |
| `docs/progress-archive/next-action-history.md` | a marker under the archived 2d-5-3-C prose, and a fresh top-of-copy marker on the 2d-5-3-D prose archived by this round |
| `PROGRESS.md` status row for 2d-5-3-D | a `⚠️` clause appended naming both corrections |
| `PROGRESS.md` Next-action | archived wholesale and replaced |

**What the sweep refused to correct.** The five `list_documents` positions 2d-5-3-D itself protected —
those saying a refused `list_documents` leaves **`workspaceReady()` unreached** — are a claim about the
*gate*, they are true, and they are untouched. That refusal is now two rounds old and still right.

## 5. Verification

Every gate run by the orchestrator, each command on its own, **twice** — once on the tree as inherited
and once on the tree this phase commits. Figures and the three host-scar consequences are in
`PROGRESS.md`'s verification baseline, which is the live head; they are not restated here, because a
figure repeated in two places is a figure that goes stale in one.

The two structural checks this chain runs on every fix, both on the committed tree:

- **The diff is comment-only, proven mechanically rather than by eye**: `git diff -U0` over
  `reconciliationCoordinator.ts`, filtered to changed lines that are neither comment lines nor blank,
  returns nothing. `numstat` is **`23 10`**.
- **No line in the edited file exceeds 90 characters** (`awk 'length > 90'`), because 2d-5-3-C shipped a
  112-character line that nothing in this repository catches.
- **The instrument's pin held** at `5 insertions(+), 1 deletion(-)` on the inherited tree and again
  after the fix, and `git status --short --untracked-files=all` names exactly the four harness paths.

## 6. §7.1 disposition

The fix changed **one source file** — `src/lib/browser/reconciliationCoordinator.ts` — so **§7.1
commissions a round** and this phase is **`SUPERSEDED BY 2d-5-3-F`, never complete**. The record half of
the fix commissions nothing: `docs/` and `PROGRESS.md` are both on §7's closed list.

Under `/autoclaude-opus` a phase gets **one** review invocation and this phase spent it, so that round
is a new corrective phase carrying it (`CLAUDE.md` §7.4) rather than a second review here.

**Nothing is `BLOCKED`.** The review marked both Mediums *actionable* correctness defects in source,
which §7.3 makes blockers unless fixed in this round's fix — and **both were fixed in it**. No item in
§8 names a defect in a source file.

## 7. What this round did not do

It did not reproduce 2d-5-3's able-to-fail claims for seven of its eight cases, nor its §8.3
five-failure transcript. No round of this chain has, and this is the second consecutive round to leave
that residue untouched, because both of its findings needed re-derivation against Rust instead.

It did not enumerate the "asserted in five comment paragraphs" count that 2d-5-3-D's §8 states and the
reviewer recorded as `NOT-VERIFIED`. That figure is **still unverified** and is carried as such rather
than repeated as though it had been checked.

## 8. Where it is thin

1. **The new Rust citation is this round's own most likely defect — *actionable*, and it is not a
   correctness defect in source.** The comment now names
   `a_failed_reopen_keeps_the_previous_watcher_watching` by symbol from a TypeScript comment. Nothing in
   this repository fails if that test is renamed, moved or deleted, and it is a **cross-language**
   anchor, which is a new kind here. It was introduced deliberately: the alternative was leaving a false
   absence claim standing, and a citation that can drift is better than a claim that is wrong now. A
   later phase may adopt it; §7.3 holds no step open for it.
2. **The queue half is unpinned and is now the only unpinned half — *recorded only*.** An edit that
   reset the reconciliation queue on the refusal path would falsify the corrected paragraph with every
   gate in the project green. That is narrower than what 2d-5-3-D claimed for the whole state, and it is
   real. Its fix is a test that drains after a refused open, which nothing in this chain's scope asks
   for.
3. **The five-paragraph count is unverified — *actionable*, in the record.** 2d-5-3-D's §8 says the
   three-state claim is asserted in five comment paragraphs; neither that round nor this one enumerated
   them, and the reviewer recorded the count as `NOT-VERIFIED`. Whoever next touches those paragraphs
   should count them rather than inherit the number — this project has already lost three step records
   to a figure copied forward instead of re-derived.
4. **The cross-epoch watermark question is untouched here — *recorded only*.** `ReconciliationQueue::drain`'s
   `acknowledged.max(after_sequence)` is unconditional and epoch-blind; whether the losing dispatch order
   occurs at all is Tauri's scheduling and is readable from nothing in this repository. Its real fix is a
   wire change owned by **2d-5-5**.
5. **The record propagation was found by `rg` on two shapes, not by reading every file end to end —
   *recorded only*.** A position that states either claim in words neither pattern matches is still
   standing. The mitigation used was to sweep for the *shape* rather than for the finding's wording,
   which is `CLAUDE.md`'s rule and is what found the `next-action-history.md` instance.
