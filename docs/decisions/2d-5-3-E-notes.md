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

> **Correction, 2d-5-3-G.** The clause *"which is the half this arm actually rests on, because what the
> arm needs is …"* is **false**, and so is the sentence it put into the source comment. **This arm rests
> on nothing of the kind**: it calls `record(afterSequence, reasons, 'staleOpen')` and returns, where
> `afterSequence` is the **pre-await** watermark captured before `host.drain(...)`, and
> `batch.newest_sequence` is consumed in `accept()` alone — which this arm returns above and never
> reaches. It contradicted two paragraphs of the very comment block it was added to: 2d-5-3-C's
> *"What makes the refusal right in all three is that nothing here can attribute the number, **never
> that the queue is gone**"*, and 2d-5-3-F's *"nothing here rests on the property"*. What survives is
> the narrower true claim: **the queue half is asserted by the comment and rested on by nothing**, so
> an edit that reset the queue on the refusal path falsifies *the comment* rather than the refusal.
> The source comment is corrected; this paragraph is left standing with the correction attached, which
> is 2d-5-3-F's precedent for a claim a later round has to re-check.

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

**2d-5-3-D's thin item 5 is closed by measurement.** It worried that the five positions citing a
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

It did not enumerate the "asserted in five comment paragraphs" count that 2d-5-3-D's §8 states and its
own reviewer recorded as `NOT-VERIFIED`. **2d-5-3-F enumerated it**: the real figure is **six**, not
five — `reconciliationCoordinator.ts` at its module doc (`:70-71`), at
`awaitingWorkspaceReady`'s doc (`:440`), and at three paragraphs of the `staleOpen` arm, plus
`workspace.svelte.ts`'s failed-open arm — and this round's own fix is what took it from five to six.
**Both halves of D's sentence were wrong by the time this round finished**: the count, and *"tested by
none"*, which is false of the workspace half precisely because of what this round's Medium 1
established.

> **Correction, 2d-5-3-G — the replacement count is not re-derivable either, and no number replaces
> it.** *"Three paragraphs of the `staleOpen` arm"* does not name a set: `runOneDrain()` has **two**
> arms that record `'staleOpen'`, and the second one — the `awaitingReady()` arm, whose paragraph says
> `WorkspaceSession::open` *"may refuse at `Workspace::discover(root)?` and leave the previous
> workspace installed indefinitely"* — asserts the third state and falls outside the six on **every**
> disambiguation. Counting sites that assert the third state gives **eight** in production; a different
> predicate gives a different number, and that is the defect rather than the arithmetic. **Five, then
> six, then eight is a count re-derived three times and pinned by nothing**, which is the fifth time
> this chain has recorded one with no mechanism behind it, so this round asserts **no** figure: what is
> written down is the criterion problem. The `:70-71` and `:440` line anchors above are also against
> this chain's own opening-words convention (2d-5-3-D §8 item 5), adopted in the commit that shifted
> lines in that file; both still resolve today, which is luck rather than a guard.

> **Correction, 2d-5-3-H — the block above carries the pair it was written to close.** *"Counting sites
> that assert the third state gives **eight** in production"* stands three lines above *"this round
> asserts **no** figure"*. That is a proposition and its negation inside one block, which is the shape
> 2d-5-3-G's own Medium 1 named, appearing in the block that round wrote to retire the count. **The
> ruling is the sound half and it stands**: the predicate is ambiguous, so the figure is a function of
> the reader and no figure belongs here. A number offered as an illustration of an ambiguous predicate
> is still a number the next round inherits — 2d-5-3-G's §4 then inherited this one, wrote *"this round
> gets **eight**"* and said *"no number is written down as the answer"* four lines later. **No
> replacement figure is written here**, and none is re-derived, on that same ruling.

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

   > **Correction, 2d-5-3-G.** The item survives, but **its premise did not**: it was written on the
   > false clause corrected in §1 above, as though the queue property were what the arm needs. It is
   > not — the arm refuses without reading `newest_sequence`. So what an edit resetting the queue
   > falsifies is **the comment's own assertion**, not the refusal's justification, and the item is a
   > **documentation-coverage** bound rather than a behavioural one. It stays *recorded only* either
   > way, so §7.3 holds no step open for it.
3. **The paragraph count was unverified and is now enumerated — *recorded only*, corrected by
   2d-5-3-F.** This item shipped saying *five*, inherited from 2d-5-3-D's §8, and repeating an
   unverified figure inside the item that warns about unverified figures. The enumerated answer is
   **six**, and this round's own fix is what added the sixth. *"Tested by none"* is false with it: the
   workspace half is pinned in Rust, which is what this round's Medium 1 established one section
   earlier. **The item is left standing with its correction attached rather than rewritten**, because
   the failure it demonstrates — a count copied forward into the very paragraph forbidding it — is
   worth more than a tidy number.
4. **The cross-epoch watermark question is untouched here — *recorded only*.** `ReconciliationQueue::drain`'s
   `acknowledged.max(after_sequence)` is unconditional and epoch-blind; whether the losing dispatch order
   occurs at all is Tauri's scheduling and is readable from nothing in this repository. Its real fix is a
   wire change owned by **2d-5-5**.
5. **The record propagation was found by `rg` on two shapes, not by reading every file end to end —
   *recorded only*.** A position that states either claim in words neither pattern matches is still
   standing. The mitigation used was to sweep for the *shape* rather than for the finding's wording,
   which is `CLAUDE.md`'s rule and is what found the `next-action-history.md` instance.
