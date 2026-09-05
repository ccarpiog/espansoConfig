# Phase 2d-5-3-J — the round §7.1 commissioned for 2d-5-3-I's fix

**Round 10 of the `reconciliationCoordinator.ts` tail.** Verdict `ship-with-fixes`, **0 blockers**,
**3 SHOULD-FIX including one Low — all three in source**, all three re-derived against the code
before any fix was applied. Review: [`docs/reviews/phase-2d-5-3-J.md`](../reviews/phase-2d-5-3-J.md).

**This round found a real defect in the previous round's fix**, which makes it **nine of the ten
rounds `2d-5-3-A` … `2d-5-3-J`**. The denominator is pinned by the letter sequence rather than by a
hand count, which is the derivation this chain writes beside every figure about itself.

**It is also the second consecutive round whose entire finding list is in source.** 2d-5-3-I was the
first; before it every round mixed source and record.

---

## 1. What was in scope

`CLAUDE.md` §7.1 scoped this round to 2d-5-3-I's fix: the four rewritten passages in
`src/lib/browser/reconciliationCoordinator.ts` (commit `eec0b70`, comment-only, one source file),
`docs/decisions/2d-5-3-I-notes.md` in full, and the one correction that round made to `PROGRESS.md`'s
2d-5-3-H git-state row.

The brief carried the instruction that has found the substantive finding of every round of this tail
— **check the comments against the code, not the code against the comments** — and one addition of
its own, taken from the handoff: **three of the four fixes under review *add* a claim, and adding is
where this tail has been weakest.** Read each addition as a claim in its own right rather than as a
repair. Two of the three findings are additions.

---

## 2. Finding 1 (Medium) — a citation for an overlap the cited test does not drive

2d-5-3-I's fix qualified the `workspace.test.ts` citation as driving two overlapping opens **"at the
host level only"**, over `scriptedCommands()`, and added *"it pins that the overlap is reachable and
pins nothing about Rust"*.

**The added clause is false under the reading its own sentence forces.** The proposition it supports
is that *"a further successful open may have installed another lifecycle and emptied the queue by
then — nothing stops one"* — an open landing while **this drain's await** is outstanding. The cited
test drives no drain at all.

**Re-derived against the code, not accepted from the review.**
`src/lib/browser/workspace.test.ts:1229` — *"lets the newer open win, however late the older one
answers"* — creates a `BrowserState`, issues `state.open(null)` and `state.open('/tmp/other')`, and
resolves the first afterwards. **It never calls `state.start()`**, and `start()` is the only route to
the coordinator: `workspace.svelte.ts:3502` is `start(): void { reconciliation.start(); }`, straight
through. With no coordinator started, no drain is ever issued, so the test overlaps two **opens with
each other** and pins nothing about an open overlapping a drain.

**What does drive that overlap was found and cited instead.**
`src/lib/browser/reconciliationCoordinator.test.ts:750` — *"installs nothing from a drain an open
overtook"*, in the suite *"the four captures around the await"* — starts the coordinator, asserts one
outstanding drain, then does `control.generation += 1; coordinator.workspaceOpened();` before
answering, and asserts `coordinator.drains()[0]?.outcome === 'staleOpen'`. That reaches **this arm**.
It moves the generation on the **injected** host, so it says nothing about Rust either — and the
comment now says exactly that rather than borrowing a Rust-shaped implication from it.

**The removal was checked for what else it carried**, which is 2d-5-3-H's lesson. The
`workspace.test.ts` clause entered at 2d-5-3-H's fix to answer 2d-5-3-G's Medium 3, which found
*"nothing in this repository drives two overlapping opens"* **false** because that test runs two. So
the clause was carrying *two overlapping opens are driven somewhere*. **It is kept**, restated as what
it actually drives, rather than deleted — deleting it would have re-created the false absence claim
2d-5-3-G raised.

## 3. Finding 2 (Medium) — "states in as many words" is false of the queue half

The paragraph opening *"A third state is neither of those"* said a refused `open_workspace` leaves the
previous workspace installed **and its queue untouched**, *"which that function's own doc comment
states in as many words"*.

**The doc comment states the workspace half and not the queue half.** Re-derived by reading the whole
of `WorkspaceSession::open`'s doc comment in `src-tauri/src/commands.rs`, which is more than the
review read:

- `commands.rs:625-627` — *"On a **failed** discovery this method returns before touching the session,
  so the previous workspace *and its watcher* both stay exactly as they were."*
- `commands.rs:679-681` — *"**A failure leaves the previously open workspace in place**, so a mistyped
  path does not empty the window."*
- `commands.rs:650-651` — the doc's **only** sentence about the queue — *"The app-write ledger and the
  reconciliation queue are emptied here, in the same block"* — is about the **success** path and says
  nothing about a failure.

**The review's derivation was incomplete and the finding survives it.** The reviewer cited `:679-681`
as the doc's only failure-path statement and missed `:625-627`, which is the stronger one — *"returns
before touching the session"* would **entail** the queue half, since the queue is a field of
`WorkspaceSession` and `reconciliation.begin_epoch` is reached only inside the swap block. The finding
holds anyway, because entailment is not what the comment claimed: `:625-627` names *the workspace and
its watcher*, and **"in as many words" is a claim of literal statement.** No sentence of that doc
comment names the queue on the failure path.

**The block already said the true thing nine lines down**, which is what makes this an
assert-and-negate pair rather than a lone overclaim: the paragraph opening *"The workspace half of the
third state"* says the queue half *"is reasoned from `WorkspaceSession::open` rather than executed"*.
**Reasoned from** and **stated in as many words** are different claims about the same sentence of
Rust, in one comment block — 2d-5-3-G's Medium 1 shape.

The fix states which half the doc comment carries, quotes both of its failure-path sentences, says
*"neither names the queue"*, and derives the queue half from the early return rather than from any
sentence — then points at the paragraph that already called it reasoned.

## 4. Finding 3 (Low) — the fix's own positional deictic, and a doubled connective

Two parts, both introduced by 2d-5-3-I's fix.

**(a)** It added *"so the falsifying edit named at the end of this paragraph does not reach it"* —
a **forward positional deictic**, six lines under the sentence declaring that the comment names sites
by their opening words *rather than* by position. It resolves, so it is a Low rather than a Medium.
Fixed by naming the edit instead of its position: *"the edit that would falsify this comment — one
that reset the queue on the refusal path"*.

**(b)** The finding-2 fix of that round replaced an *"and"* with a second *"so"*, giving *"so a change
… turns that test **red**, so the **workspace** half … is not reasoned-only"*. The second clause is not
a consequence of the first; it restates its import. Restored to *"and"*.

---

## 5. The sweep the findings commissioned, and what it found

Finding 3 is about a **shape**, so the block was swept for the shape rather than for the reviewer's
words — 2d-5-3-I's §7 item 9 names its own single-`rg`-pattern sweep as its likeliest miss, so the
pattern was widened to *above / below / here / this paragraph / this sentence / this line / next /
end of this / earlier / later* across the whole block.

**Two further positional references cited a paragraph, and both were re-anchored.** Neither was a
correctness defect — both resolved — so both fixes are pure re-anchors that add no proposition:

1. *"not about the property the paragraph above draws from it"* referred to **the same paragraph**
   that, thirty-three lines below, is named by its opening words in the sentence explaining why it is
   named that way. One referent, two conventions, one block. Now named by opening words.
2. *"the one below says the refusal rests on unattributability; the one opening *"Which lifecycle the
   batch describes"* …"* named one of a **pair** by position and its sibling by opening words, **in
   the same sentence**. Now both by opening words.

**What remains is deliberate and is recorded rather than converted.** Three positional phrases stay,
and none of them is a paragraph citation: `:740`'s *"the arm below"* refers to **code** (the
`awaitingReady()` arm) and resolves; `:798`'s *"the paragraphs above"* is a plural description of
which paragraphs classify provenance, not a citation supporting a claim; and `:819`'s *"the paragraph
above"* is the **quoted mention** of the form the sentence says it avoids, not a use of it.

**One further ambiguity was disambiguated because the fix came to rest on it.** Finding 2's fix cites
the sentence *"It is reasoned from `WorkspaceSession::open` rather than executed"*, whose *"It"* has
*"the weaker claim"* as its nearest antecedent and the queue half as its intended one. Since a new
sentence now depends on that referent, it is named: **"The queue half is reasoned from …"**. A pure
disambiguation, no new claim.

---

## 6. Verification

**All four gates were run in full, by the orchestrator, three times** — on the inherited tree before
the review was acted on, after the fix, and again after the second edit that §5's re-anchors and the
reorder produced. **`1320 / 441 / 2307 / 188` every time**, which is what a comment-only diff must
produce.

- `cargo test --workspace -- --test-threads=1` → exit 0, **read from a file rather than through a
  pipe**. **26** `test result` lines summing to **1320 passed**, and the complementary question asked:
  **no `test result` line lacking `0 failed`**, because a sum can be right while a binary is silent.
- `cargo clippy --workspace --all-targets -- -D warnings` → exit 0, read from a file.
- `cargo fmt --check` → exit 0. `cargo tree -p espansoconfig-core | rg tauri` → finds nothing.
- `npm run check` → **441 files, 0 errors, 0 warnings**. `npm test` → **60 files, 2307 passed**.
  `npm run build` → **188 modules transformed**.
- **Both bundle oracles read, and both lines reported** — the second exists to prove the search can
  match at all: server-only markers (`$$payload|head_payload|push_element`) **absent**; client-only
  markers (`window.__svelte|svelte-trusted-html`) **present, 2 matches**.

The three consequences of this host's `cargo test` scar were followed on every run: serial form,
redirected to a file rather than read through a pipe, and the complementary question asked of every
one of the 26 `test result` lines.

**The citations the fix rests on were confirmed to run, not assumed.**
`test watch_check::a_failed_reopen_keeps_the_previous_watcher_watching ... ok` is at line 242 of each
serial transcript. The newly cited `reconciliationCoordinator.test.ts` case was read in full before it
was cited, and its file is inside the 60 that pass.

**The diff is comment-only, proven mechanically rather than by eye**: `git diff -U0` filtered to
changed lines that are neither comment lines nor blank returns nothing. **No line exceeds 90
characters**, checked with `awk`, because 2d-5-3-C shipped a 112-character line that nothing in this
repository catches — and this round's first edit produced two, at 124 and 111 characters, which that
check caught and the rewrap closed.

**The instrument's pin was re-checked before the fix and after it** and held at
`5 insertions(+), 1 deletion(-)` over `src-tauri/src/main.rs` and `src/main.ts`.

**No gate in this project reads prose.** All three of this round's findings were invisible to all
four, and all three were in a source file with every gate green over it. That is sharper rather than
softer for the second consecutive round whose whole finding list is in source.

---

## 7. Where it is thin

Every item carries its `CLAUDE.md` §7.3 mark. **No item names an unfixed correctness defect in a
source file, so nothing is `BLOCKED`.**

1. **actionable — closed by measurement this round.** The review marked the archive line figures
   **123 / 55 / 80** as uncounted. All three were counted against the archive files and **all three
   are exact**: `next-action-history.md:11812-11934` is 123 lines, `phase-2d.md:3624-3678` is 55, and
   `phase-2d.md:3533-3612` is 80. Chased rather than carried, which is this chain's practice.
2. **recorded only.** The review ran **no build, test or package command**, by instruction — this
   host's watcher-concurrency scar corrupts both readings even against the frontend gates. So one
   party measured and measured three times, rather than two parties measuring once. That is the
   deliberate trade 2d-5-3-F's single run made necessary and it is unchanged.
3. **actionable.** Finding 2's fix **quotes two sentences of `commands.rs`'s doc comment verbatim**,
   at `:625-627` and `:679-681`, without a `file:line` anchor — deliberately, since this chain's own
   Medium at 2d-5-3-C was a line anchor that went stale inside its own commit. **A quotation drifts
   differently from a line number: it fails by ceasing to match rather than by silently naming
   something else.** Nothing in this repository checks either. This is the fourth phase to nominate a
   citation checker; **no count of those nominations is written here**, per 2d-5-3-H's finding 4.
4. **recorded only.** `commands.rs` beyond `open()`, its doc comment and `begin_epoch` is still unread
   by this tail. This round read more of it than any predecessor — the whole of `open()`'s doc comment
   rather than the two sentences the review named — and that is exactly what turned finding 2's
   derivation around.
5. **recorded only.** **2d-5-3's able-to-fail residue (2d-5-3-D §8 item 4) is still unreproduced after
   seven consecutive rounds**, and the honest statement remains that no round has had it in scope.
6. **recorded only.** The `ReconciliationQueue::drain` watermark carry
   (`src-tauri/src/reconciliation.rs`) is untouched and out of scope; reachability is unestablished and
   a real fix is a wire change owned by **2d-5-5**.
7. **recorded only.** The three positional phrases §5 deliberately left are the likeliest place for a
   later round to disagree with this one. Each is recorded there with the reason it is not a paragraph
   citation. A round that converts them should say what it thinks each one cites — the
   argument for leaving them is that a conversion adds a claim for no correctness gain.
8. **recorded only.** `:800-801`'s *"no scripted-command suite … drives Rust at all — **its**
   failed-open case"* puts a singular possessive over a negated plural. Pre-existing, prose only, and
   the review raised it; left alone rather than opening a sentence this round has no finding about.
9. **recorded only.** Finding 1's fix **adds three propositions** — that the cited host test contains
   no drain, that it never calls `start()`, and that the coordinator test moves the generation on the
   injected host. Each was read out of the test bodies before being written, and each is the kind of
   claim that goes stale when a test is edited. **Nothing pins any of the three.** By this tail's own
   history, an addition is the likeliest thing for the next round to find.
