# Phase 2d-5-3-K — the round §7.1 commissioned for 2d-5-3-J's fix

**Round 11 of the `reconciliationCoordinator.ts` review tail**, and the eleventh consecutive round
commissioned by its predecessor's fix. Scoped to 2d-5-3-J's comment-only source diff
(`3428cde`, 33 insertions and 20 deletions in one file) and to `docs/decisions/2d-5-3-J-notes.md` in
full.

Review: [`docs/reviews/phase-2d-5-3-K.md`](../reviews/phase-2d-5-3-K.md). Verdict
**`ship-with-fixes`, 0 blockers**, **3 SHOULD-FIX**. **All three were re-derived against the code by
the orchestrator before any fix was applied, and all three hold** — one of them with a correction to
the review's own arithmetic (§4). **One of the three is in source and two are in the record**, which
ends the two-round run of all-source finding lists that 2d-5-3-I and -J produced.

**Ten of the eleven rounds `2d-5-3-A` … `2d-5-3-K` have found a real defect in the previous round's
fix.** The denominator is the letter sequence, not a hand count; the one exception is 2d-5-3-F, whose
record read its own *0 Medium* as convergence and was wrong.

**This round found a defect in its own fix before committing it, and that is worth more than the
review's own list.** The first draft of finding 1's replacement sentence asserted that *every* `open()`
in the cited test reaches `workspaceReady()`. It does not: `open()`'s own comment at that call site
says *"Every early return above — a superseded generation, a refused `open_workspace`, a refused
`list_documents` — leaves this unreached"*, and the **superseded** open in that very test is the first
of those cases. The sentence was corrected to *"the open that wins reaches `workspaceReady()`"* before
any gate ran. **The addition was the thing that needed checking**, exactly as this tail keeps finding.

---

## 1. What was in scope

The passages 2d-5-3-J rewrote: the `workspace.test.ts` / `reconciliationCoordinator.test.ts` citation
pair; the paragraph quoting two sentences of `src-tauri/src/commands.rs`; the two re-anchored paragraph
references; the named falsifying edit; the restored *"and"*; and the *"The queue half is reasoned
from …"* disambiguation. Plus `2d-5-3-J-notes.md` in full.

**What the brief told the reviewer to hunt was the *additions*.** 2d-5-3-J's fix asserted more new
propositions than any of the four before it — three about test bodies, one absence claim about a Rust
doc comment, and two verbatim quotations of that comment — and nothing in this repository pins any of
them. Two of the three findings are in that set.

---

## 2. Finding 1 (SHOULD-FIX) — "no coordinator runs in it" is a false attribution

`reconciliationCoordinator.ts`, the sentence that read *"it never calls `start()`, so no coordinator
runs in it"*.

**Re-derived against the code, not accepted from the review.** In
`src/lib/browser/workspace.test.ts`'s *"lets the newer open win, however late the older one answers"*,
coordinator code runs from the first line onwards:

- `createBrowserState` constructs one unconditionally — the `createReconciliationCoordinator(...)`
  binding in `workspace.svelte.ts` is not behind any flag, and the test calls `createBrowserState`.
- Every `open()` calls `reconciliation.workspaceOpened()` **synchronously, before its first await**:
  the call sits directly under `const generation = ++openGeneration;` with nothing awaited between
  them. The test issues two opens, so it runs twice.
- The open that **wins** reaches `reconciliation.workspaceReady()`, whose whole body is
  `openInProgress = false; requestDrain('workspaceOpened');`.
- `requestDrain` then **remembers** that reason rather than dropping it —
  `drainMayStart()` is `started && !disposed && !awaitingReady()`, and `started` is false — which is a
  documented property of that function, not an accident of it.

**The conclusion holds and the reason does not.** No *drain* is issued in that test, which is what the
paragraph needs; what `start()` gates is the drain, not the coordinator. The old sentence claimed the
coordinator is inert there, and it is not.

**The same error, in its strong form, is in `2d-5-3-J-notes.md` §4**: *"`start()` is the only route to
the coordinator"*. `workspaceOpened()` and `workspaceReady()` are two more routes and neither needs
`start()`.

**One addition of this round's own was caught before it shipped**, and it is the sharper half of this
finding. The replacement first read *"each `open()` calls `workspaceOpened()` and then
`workspaceReady()`"*. **False of the superseded open**: the comment at that call site enumerates three
early returns that leave `workspaceReady()` unreached, and *a superseded generation* is the first of
them — which is precisely what happens to the losing open in the cited test. Corrected to name the
winner before any gate was run.

**The repository-wide absence claim beside it was narrowed rather than carried.** 2d-5-3-J's fix wrote
*"**no test in this repository drives that overlap against Rust**"*, and the reviewer returned it as
`NOT-VERIFIED`: a grep does not close a universal. Chased as far as a grep goes — every
`session.drain_external_changes(...)` call in `commands.rs`'s own tests is synchronous and no
`thread::spawn` appears among them, so no Rust test can even express an open landing during an
outstanding drain — and
then **replaced by the claim the paragraph actually needs**: *"the two tests that come nearest drive
that overlap somewhere other than Rust, and nothing wider is claimed here"*. That is pinned by the two
derivations immediately under it. **It is not a false absence written to replace a false coverage
claim** (2d-5-3-E's shape): the universal is not asserted anywhere, in either direction.

**Fixed in source** (the false reason replaced by the true one, the absence claim scoped) and **in the
record** (a correction block on `2d-5-3-J-notes.md` §4).

---

## 3. Finding 2 (SHOULD-FIX) — three line anchors in `2d-5-3-J-notes.md` do not resolve

**Re-derived on `3428cde`, the tree that round committed**, because an anchor is a claim about a tree:

| The notes say | What is there on `3428cde` |
|---|---|
| §5's `:798` — *"the paragraphs above"* | **797** |
| §5's `:819` — *"the paragraph above"* | **818** |
| §7 item 8's `:800-801` — *"no scripted-command suite …"* | **812**; `:800` is where it sat in `eec0b70`, the tree that round *inherited* |

The third is **2d-5-3-C's shape exactly** — a citation that went stale inside the commit that wrote
it — and `2d-5-3-J-notes.md` §7 item 3 cites that very precedent, three items above the instance.

**A fourth was found by the sweep and not by the review.** §4's
`reconciliationCoordinator.test.ts:750` names a line one below the `it(...)` it quotes, which is on
**749** (its `describe`, also quoted there, on **748**).

**Fixed in the record, and the numbers are dropped rather than corrected.** Every one of the four
citations already quotes a phrase that is unique in its file, so the number carried nothing the words
did not. That is this chain's own remedy since 2d-5-3-C, and this round has the demonstration for it:
**its own fix moved three of those four phrases again**, so any replacement figure written here would
have been stale in the commit that wrote it. The correction blocks therefore state what was true of
`3428cde` and assert no current number.

---

## 4. Finding 3 (SHOULD-FIX) — §5's "Three positional phrases stay" is not a count of what stayed

**Re-derived by re-running the sweep** §5 describes — *above / below / here / this paragraph / this
sentence / this line / next / end of this / earlier / later* — over the whole block.

Two matches sit outside the three §5 enumerated:

1. *"**The case-2 sentence above** is not a second site for it."* It **stays**, on §5's own stated
   criterion: it cites a **sentence**, and the convention the block declares — *"names it by its
   opening words rather than saying the paragraph above"* — is about **paragraph** citations. What is
   wrong is only the enumeration that omits it.
2. *"reached only inside the swap block **below it**"*, which **2d-5-3-J's own fix had added** one
   round earlier, and whose *"it"* has *"any sentence"* as its nearest antecedent rather than the
   early return it means. **Rewritten** to *"the swap block that early return skips"*, which removes
   the positional phrase and the ambiguous pronoun together.

**The review's arithmetic on the first of these was corrected rather than accepted.** It placed the
case-2 sentence *"one line below §5's third enumerated survivor"* — true only of that survivor's
**stale** anchor. Measured from where the survivor actually is, the two sit in the **same paragraph**,
two lines apart on `3428cde`. This is the second consecutive round in which a reviewer's own derivation
was incomplete and the finding survived it anyway.

**No figure replaces "three".** 2d-5-3-H's finding 3 was a section that retired a count and asserted
it in the same breath, and a bare number here would go stale the next time anyone edits the block. What
the correction records is the **criterion**: paragraph citations are converted; code references, plural
descriptions, quoted mentions and sentence citations are recorded. §7 item 7 of that file inherits the
same count and the same correction.

---

## 5. What was checked and found sound

Recorded because a round that reports only its findings hides the work that produced them, and because
these are the claims a later round would otherwise re-derive from scratch:

- **Both `commands.rs` quotations are verbatim.** *"returns before touching the session, so the
  previous workspace and its watcher both stay exactly as they were"* and *"leaves the previously open
  workspace in place"* match the doc comment character for character, modulo the Rust doc's own
  emphasis markers, and the second really is in its `# Errors` section.
- **`neither names the queue` is true of both**, and the wider *"that function's doc comment states
  the workspace half and not the queue half"* survives the doc's one queue sentence, which is about
  the **success** path.
- **The queue half's mechanical premise holds.** `self.reconciliation.begin_epoch(...)` appears in
  `WorkspaceSession::open` **once**, inside the block that holds the session lock, below
  `Workspace::discover(root)?`. A failed discovery cannot reach it.
- **Every opening-words anchor resolves to exactly one paragraph**: *"A third state is neither of
  those"*, *"The workspace half of the third state"*, *"Which lifecycle the batch describes"* and
  *"What makes the refusal right in all three"* each match one paragraph opening, with their citation
  sites distinct from them.
- **The two test citations are accurate about what the tests drive.** `workspace.test.ts`'s test
  overlaps two opens and issues no drain; `reconciliationCoordinator.test.ts`'s *"installs nothing
  from a drain an open overtook"* does `control.generation += 1; coordinator.workspaceOpened();` with
  one drain outstanding on the **injected** host and asserts `'staleOpen'`. Only the *reason* given for
  the first was wrong (§2).
- **`:740`'s *"the arm below"*** — §5's first survivor — resolves, and is a reference to code.

---

## 6. Verification

**All four gates were run in full, by the orchestrator, twice** — on the inherited tree before the
review was acted on, and on the tree this phase commits. **`1320 / 441 / 2307 / 188` both times**,
which is the same rung this tail has now measured **twenty times across eleven phases** (2d-5-3-J's
recorded eighteen across ten, plus this round's two).

- `cargo test --workspace -- --test-threads=1` — serial form, **redirected to a file rather than read
  through a pipe**, **26** `test result` lines summing to **1320**, and the complementary question
  asked of every one of them: **no line lacking `0 failed`**. All three consequences of this host's
  `watch_check` scar were followed on both runs.
- `cargo clippy --workspace --all-targets -- -D warnings` — exit 0, read from a file.
- `cargo fmt --check` — exit 0. `cargo tree -p espansoconfig-core | rg tauri` — finds nothing.
- `npm run check` — **441 files, 0 errors, 0 warnings**. `npm test` — **60 files, 2307 passed**.
  `npm run build` — **188 modules**, with **both** bundle oracles read on both builds: server-only
  markers **absent**, client-only markers **present (2)**.

**The source diff is comment-only, proven mechanically twice** — `git diff -U0` filtered to changed
lines that are neither comment lines nor blank returns nothing, after the first edit and again after
the correction §2 describes. **No line in the edited file exceeds 90 characters**, checked with `awk`
after each edit. **The instrument's pin was re-checked before and after** and holds at
`5 insertions(+), 1 deletion(-)`.

**Two runs rather than three, and the difference from 2d-5-3-J is the point.** That round needed a
third because an edit landed after a green reading. Here the second source edit — the
`workspaceReady()` correction — was made **before** any gate ran, so the tree the gates measured is the
tree that commits. **A green figure is about the tree that produced it**, and the way to keep that true
is to finish editing first, not to re-run afterwards.

**No gate reads prose.** All three of this round's findings, and the one this round found in its own
fix, were invisible to all four — as every finding of this tail has been.

---

## 7. Where it is thin

Marked per `CLAUDE.md` §7.3. **No item names an unfixed correctness defect in a source file**, so
nothing here holds the step open.

1. **recorded only.** The narrowed sentence *"the two tests that come nearest drive that overlap
   somewhere other than Rust"* is now a claim about **which two tests come nearest**, which nothing
   pins. A third test that drove the overlap closer would falsify it with every gate green. It is
   weaker than the universal it replaced and is checkable by reading two named tests, which is why it
   was preferred — but it is still prose.
2. **actionable**, and a later phase may adopt it: nothing in this repository resolves a `file:line`
   citation in a comment or a record. This round found **four** stale ones in a single notes file and
   fixed them by deleting the numbers; the candidate corrective phase under *Next action* in
   `PROGRESS.md` names four more in `src/`. **No count of what a checker would nominate is asserted
   here**, per 2d-5-3-H's finding 4.
3. **recorded only.** §2's fix adds three propositions of its own: that `createBrowserState`
   constructs the coordinator unconditionally, that `workspaceOpened()` precedes the first await, and
   that the winning open reaches `workspaceReady()` while a superseded one does not. Each was read out
   of `workspace.svelte.ts` before being written and the third was **corrected** during the writing.
   By this tail's history, an addition is the likeliest thing for the next round to find.
4. **recorded only.** `2d-5-3-J-notes.md` now carries a correction block at every site this round
   touched — the count is `rg -c 'Correction, 2d-5-3-K'` and is deliberately not written out here,
   since a figure in prose is the thing §3 and §4 were both about. A file corrected in place at many
   sites is harder to read than one rewritten, and this chain's convention — leave the original as written, correct in a block — is what produces that. The
   convention is not changed here; the cost is recorded.
5. **recorded only.** `src-tauri/src/commands.rs` beyond `open()`, its doc comment and `begin_epoch`
   is **still** unread by this tail. This round read the two quoted sentences, the `# Errors` section,
   the `open()` body and every `drain_external_changes` call site in that file's tests — more than any
   round before it — and that is still a small part of a file of over eight thousand lines.
6. **recorded only.** 2d-5-3's able-to-fail residue (`2d-5-3-D-notes.md` §8 item 4) is **still
   unreproduced**, now after eight consecutive rounds. No round has had it in scope, which is the
   honest statement rather than a claim that it is unreproducible.
7. **recorded only.** The sweep in §4 used the same widened pattern 2d-5-3-J introduced. It matches
   *"here"* in its ordinary sense — *"nothing here rests on the property"* — many times over, and
   those are not citations of a site; distinguishing them is a reader's judgement that no pattern
   encodes. A round that wants a mechanical answer needs a different instrument, not a wider pattern.
