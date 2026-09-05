# Phase 2d-5-3-I — the round §7.1 commissioned for 2d-5-3-H's fix

**Risk class high; worker model `opus`.** No implementation worker: the phase's product is a review and
its fix, both taken by the orchestrator. Review:
[`docs/reviews/phase-2d-5-3-I.md`](../reviews/phase-2d-5-3-I.md). Verdict **`ship-with-fixes`, 0
blockers**, 3 SHOULD-FIX — **all three in source**, one of them a Low. **All three were re-derived
against the code by the orchestrator before any fix was applied, and all three hold.**

**Round 9 of the `reconciliationCoordinator.ts` review tail.** Scoped to 2d-5-3-H's fix and to nothing
else: the two rewritten passages in `src/lib/browser/reconciliationCoordinator.ts`,
`docs/decisions/2d-5-3-H-notes.md` in full, and the four correction blocks that round added to
`2d-5-3-G-notes.md` (three) and `2d-5-3-E-notes.md` (one). The brief carried the one instruction this
tail keeps being paid by — **check the comments against the code, not the code against the comments** —
and all three findings came out of it.

**This round found a real defect in the previous round's fix.** Written with its derivation rather than
as a bare cardinal, which is what 2d-5-3-H's §3 and §4 were about: that round recorded *seven of the
eight rounds `2d-5-3-A` … `2d-5-3-H`*, this round adds one to each, so **eight of the nine rounds
`2d-5-3-A` … `2d-5-3-I`** — and the denominator is pinned by the letter sequence rather than by a hand
count.

**The first round of this tail whose entire finding list is in source.** Every previous round mixed
source and record; this one returned three findings and all three name lines of
`reconciliationCoordinator.ts`. The record correction in §4 below was **not a review finding** — it is
a `NOT-VERIFIED` item the reviewer flagged as *incomplete, not false*, and the orchestrator chased it
down rather than carrying it, which is 2d-5-3-H's own precedent.

**2d-5-3-H's nominated most likely defect was, once again, not the one that broke.** It named its §5
fix's claim that *"the refusal does not need it to be [knowable]"* is **weaker** than *"the refusal
rests on unattributability"* — a reading of two English sentences that no gate can separate. **That
reading was re-derived here and holds**, and the reviewer did not challenge it. What broke was the
*other* half of the same fix: the list of sites that fix went on to name.

---

## 1. SHOULD-FIX (source) — the fix named a second asserting site the same block excludes

`src/lib/browser/reconciliationCoordinator.ts`. 2d-5-3-H's passage B wrote:

> So the queue half is **asserted in prose and rested on by nothing here** — asserted by the paragraph
> opening *"A third state is neither of those"*, **and again by the case-2 sentence above**, which are
> the sites this sentence means …

**The paragraph defines "the queue half" one sentence earlier, and the definition excludes case 2.** Its
opening sentence is *"The workspace half of **the third state** is driven and asserted in Rust; the queue
half is not"* — so the queue half is a property **of the third state**, the refused-open case. The
case-2 sentence is about a **successful** open that lost the lock race, and the paragraph opening
*"A refused `list_documents` is not that state"* separates the two in as many words: the batch *"is one
of those two, whichever the race gave, and **never this one**"*.

**The paragraph's own falsifiability test settles it.** It ends *"an edit that reset the queue **on the
refusal path** would falsify **this comment**"*. That edit does not touch the case-2 sentence at all, so
a site the falsifying edit cannot reach is not a site of the claim the falsifying edit tests.

**Why 2d-5-3-H wrote it.** Its own Low 5 observed that the case-2 sentence it had just rewritten *"became
a second site asserting the property"*, and that is true of the property **text** — the case-2 sentence
quotes *"its `newest_sequence` really is a watermark for the lifecycle Rust is still holding"* verbatim.
The fix then carried that observation one step too far and listed the two sites as sites of the same
claim. **Repeating a proposition about a different case is not asserting the same claim**, and that
distinction is the finding.

**Fixed** by citing the *"A third state"* paragraph **and that one alone**, and adding an explicit
sentence saying the case-2 sentence is *not* a second site for it, with the reason (same property text,
different case) and the consequence (the falsifying edit does not reach it). Naming the site by its
opening words is kept, because that is what closed 2d-5-3-H's ambiguity and it still does.

## 2. SHOULD-FIX (source) — the paragraph that declares it avoids *"the paragraph above"* still said it

`src/lib/browser/reconciliationCoordinator.ts`. The same paragraph contained, four lines above the
sentence announcing the policy, *"a change that let a refused open replace or empty the session turns
that test **red**, and **the paragraph above** is not reasoned-only"* — while the next sentence said it
names sites by opening words *"rather than saying **the paragraph above**"*. **A paragraph that
announces a policy and violates it four lines earlier is the contradiction-inside-one-block shape this
tail found at 2d-5-3-G** and it shipped inside the fix written to close the same shape's sibling.

**And the deictic resolves to the wrong paragraph.** What
`a_failed_reopen_keeps_the_previous_watcher_watching` de-reasons is the claim *a refused open leaves the
previous workspace installed* — asserted in the paragraph opening *"A third state is neither of those"*.
The paragraph **literally** above passage B is the refused-`list_documents`/case-2 paragraph, which
2d-5-3-H itself expanded, and it asserts no such thing. Re-derived by reading both paragraphs and the
test (`src-tauri/src/watch_check.rs:514`).

**Fixed** by naming the paragraph by its opening words and by narrowing the claim to *"the **workspace**
half of"* that paragraph — because the paragraph asserts both halves and the next sentence says only the
queue half is unpinned, so the unqualified form over-claimed on the half it goes on to exclude.

## 3. SHOULD-FIX (source, Low) — a `scriptedCommands()` test cited for a Rust-side effect

`src/lib/browser/reconciliationCoordinator.ts`. 2d-5-3-H's passage A wrote *"a further successful open
may have installed another lifecycle **and emptied the queue** by then — nothing stops one, and
`./workspace.test.ts`'s *"lets the newer open win, however late the older one answers"* drives two
overlapping opens"*. Installing a lifecycle and emptying the queue are **Rust-side** effects
(`reconciliation.begin_epoch`), and the cited test is a **frontend** test over `scriptedCommands()` — a
fake. Nine lines below, the same comment block says *"**no scripted-command suite in
`./workspace.test.ts` drives Rust at all**"*. The citation is therefore contradicted by the block it
sits in.

**Re-derived rather than accepted.** `src/lib/browser/workspace.test.ts:1229` — the test exists with that
exact title, in the suite named *overlapping requests*, and it builds its commands as
`{ ...scriptedCommands(), openWorkspace: vi.fn(...) }` and drives two `state.open()` calls whose answers
both resolve `ok`. So it does pin that **two overlapping successful opens are reachable**, at the host
level, and it pins nothing at all about Rust.

**The claim the citation supports is still the right one**, which is why this is a Low and why the
citation is qualified rather than removed. `PROGRESS.md`'s Next-action prose for this round already said
so — *"the new citation pins the frontend's behaviour and must not be read as Rust coverage"* — and
**that qualification was in the record and not in the comment**, where the reader who needs it is.

**Fixed** by qualifying the citation in place: *"drives two overlapping opens **at the host level only**,
over `scriptedCommands()`: it pins that the overlap is reachable and pins nothing about Rust"*.

## 4. Not a review finding — a record incompleteness the orchestrator chased rather than carried

The reviewer listed as `NOT-VERIFIED`, marked *incomplete, not false*, that `PROGRESS.md`'s 2d-5-3-H
git-state row names **two** archives where that round's header names **three**. Checked and true: the row
ended *"and, in a second archive taken before a word was written …"* and stopped there, while the header
recorded a third — that header's own headroom narrative, 80 lines, taken **after** the record went in
because the file stood at 794 lines, six under the bound.

**Two figures about the same event, in one file, disagreeing** is the shape this chain has corrected
repeatedly, and *"incomplete"* is how it always looks from the shorter side. Corrected in place, with the
reason the third archive was needed and a note that the row said *two* until this round counted it
against the header. Record-only; it changed no source file.

## 5. The sweep the findings commissioned, and the fourth site it found

**Finding 2 is about a shape, not about one sentence**, so the file was swept for the shape rather than
for the words — the rule `CLAUDE.md` states after four rounds of 2c-4a-2 each left a narrower instance
standing. `rg -n 'the paragraph above|the paragraphs above|the arm below|the paragraph below'` over
`reconciliationCoordinator.ts` returns six sites. Each was resolved by reading. **The line numbers below
are the inherited tree's — commit `8e457d1`, before this round's fix — and are stated as such rather
than renumbered**, because a correction whose own citation is stale in its own commit is the defect
2d-5-3-C shipped and 2d-5-3-C had to fix in four places:

| Site | Text | Verdict |
|---|---|---|
| `:740` | *"the arm below states again"* | **correct** — the `awaitingReady()` arm below does state the same independence |
| `:773` | *"the property the paragraph above draws from it"* | **correct and unambiguous** — the paragraph literally above is *"A third state is neither of those"*, which is the one that draws it |
| `:783` | *"Provenance is what the paragraphs above classify"* | **correct** — plural, and the case paragraphs are what classify provenance |
| `:795` | *"the paragraph above is not reasoned-only"* | **finding 2** — wrong referent, inside the paragraph that declares it avoids the form |
| `:803` | *"rather than saying *the paragraph above*"* | **the policy sentence itself**, not a use |
| `:824` | *"exactly as the paragraph above says"* | **a fourth site the review did not name — fixed here** |

**`:824` is the one the sweep bought.** The sentence is *"Under `./workspace.svelte.ts` the cursor has
also just been cleared, which makes the same refusal right a second way — a property of that host and
not of this line, exactly as the paragraph above says."* The paragraph literally above it is passage B,
which says nothing about the cursor or about that being a host property. The paragraph that does say it
is the block's **first** — *"An `open()` landed while this was in flight … that is true whether or not
the cursor has been cleared — nothing on this line observes `workspaceOpened()`"* — **five paragraphs
up, with four nearer candidates in between**. Fixed by naming it by its opening words.

**This is the same shape as finding 2 and it was outside the review's scope**, which is worth recording
plainly: the round was scoped by §7.1 to *the two rewritten passages*, and a scope stated as a count of
passages is a scope that invites a sweep bounded by that count. The shape was not so bounded.

## 6. Verification

**Every gate was run in full, twice — once on the inherited tree before the review was acted on, and
once after the fix — and every figure was run rather than inferred.** Both runs answer
**`1320 / 441 / 2307 / 188`** (`cargo test --workspace` / `npm run check` files / `npm test` /
`npm run build` modules), which is the recorded baseline unmoved.

That makes **fifteen independent full runs across nine phases returning the same four figures** — and
that is 2d-5-3-H's recorded *thirteen across eight* plus this round's two, written with its derivation
because a bare running total about this chain's own history is exactly the shape 2d-5-3-H's findings 3
and 4 were about.

**The three consequences of the host scar were followed on both runs.** `cargo test --workspace --
--test-threads=1` in serial form, redirected to a file rather than read through a pipe, summed over
**26** `test result` lines *and* checked by the complementary question — `rg '^test result' | rg -v '0
failed'` returns nothing on both. `cargo clippy --workspace --all-targets -- -D warnings` (exit 0, to a
file), `cargo fmt --check` (exit 0) and `cargo tree -p espansoconfig-core | rg tauri` (finds nothing)
are clean on both.

**Both bundle oracles were read on both builds and both lines are reported**, the second because it
proves the search can match at all: server-only markers (`$$payload|head_payload|push_element`)
**absent**, client-only markers (`window.__svelte|svelte-trusted-html`) **present (2)**.

**The citation the untouched half of the comment block rests on was re-confirmed rather than assumed.**
`test watch_check::a_failed_reopen_keeps_the_previous_watcher_watching ... ok` is present in **both** of
this phase's serial transcripts, at line 242 of each. A citation naming a test that does not run is the
defect a later round of this tail would find, and it costs one `rg` to rule out.

**Nothing moved, and nothing could have.** The source diff is **comment-only in the one file it
touches**, proven mechanically rather than by eye: `git diff -U0` filtered to changed lines that are
neither comment lines nor blank returns nothing. No file entered or left the program, no new reachable
module, no new component, no new case — so neither ladder rung has anything to apply to, and no
pristine-tree rebuild was needed to say so. **No line in the edited file exceeds 90 characters**,
checked with `awk`, because 2d-5-3-C shipped a 112-character line that nothing in this repository
catches.

**The instrument's pin was re-checked before the fix and after it** and held at
`5 insertions(+), 1 deletion(-)` over `src-tauri/src/main.rs` and `src/main.ts` both times.

**What no gate in this project can do.** No gate reads prose. All three of this round's findings were
invisible to all four — a citation naming a site its own paragraph excludes, a deictic resolving to the
wrong paragraph inside the paragraph that forbids the form, and a frontend test cited for a Rust-side
effect nine lines above the sentence saying that suite drives no Rust. Four green figures are evidence
about code and evidence about nothing this round changed.

## 7. Where it is thin

Marks per `CLAUDE.md` §7.3. **No item here commissions a round**; §7.1 alone does that, and it reads a
diff.

1. **actionable** — §1's fix adds a sentence saying the case-2 sentence *"is not a second site for it"*.
   That is a claim about what the sentence above **means**, not about what any code does, and no gate
   and no test can separate it from its negation. A later round reading the two sentences as making the
   same claim would call the new sentence redundant rather than wrong. It names no defect in source.
2. **actionable** — §2's fix narrows a claim to *"the **workspace** half of"* a paragraph. The narrowing
   is right by the paragraph's own next sentence, but **nothing pins it**: a later edit dropping the
   qualifier turns nothing red, and a dropped qualifier is precisely the class this tail keeps finding
   (2d-5-3-H's source finding 1 was one).
3. **recorded only** — the *"at the host level only"* qualifier added in §3 is prose. The fact it
   asserts is checkable (`workspace.test.ts:1229` spreads `scriptedCommands()`), and the assertion that
   the fact **matters here** is not.
4. **recorded only** — **the overlapping-open case still drives no Rust.** This round confirmed it by
   reading the test rather than by inheriting the claim, and the new qualifier now says so in the
   comment. Rust-side overlapping opens remain uncovered by any test in this repository.
5. **recorded only** — **`commands.rs` beyond the three items this tail has read is still unread**, and
   this round read no new Rust at all. It re-read `watch_check.rs:514` only to resolve §2's referent.
6. **recorded only** — **2d-5-3's able-to-fail residue (2d-5-3-D §8 item 4) is still unreproduced after
   six consecutive rounds.** The honest statement is unchanged: no round has had it in scope, and scope
   is set by §7.1 rather than chosen.
7. **recorded only** — the carried 2d-5-3-C finding is untouched: a losing drain can seed a fresh
   queue's watermark with the previous epoch's number (`ReconciliationQueue::drain`). The reviewer
   re-found it independently, at `src-tauri/src/reconciliation.rs:1186` and `:1210-1211`, and did not
   re-raise it because reachability is still unestablished. The real fix is a wire change owned by
   **2d-5-5**.
8. **actionable** — **the citation checker is still unbuilt.** This round resolved six deictic sites by
   hand and found one the review missed; a checker that resolved *"the paragraph opening X"* anchors
   mechanically would have found it for nothing. No figure is written here for how many times it has
   been nominated: 2d-5-3-H's finding 4 established that two archived blocks say *"four times"* and one
   says *"five"*, and nothing derives either.
9. **recorded only** — **the sweep in §5 was bounded by one `rg` pattern.** It covers *"the paragraph
   above/below"*, *"the paragraphs above"* and *"the arm below"*. Other deictics in this file — *"the
   sentence this comment opens with"*, *"the arm above"*, *"as the paragraph above says"* variants with
   different wording — were not enumerated, and a deictic phrased in words the pattern does not hold is
   invisible to it. That is the same bound that let §5's fourth site survive eight rounds.

## 8. §7.1 — a round is commissioned

**The fix changed one source file** — `src/lib/browser/reconciliationCoordinator.ts` — comment-only,
proven mechanically. The other change is `PROGRESS.md`, which is on §7's closed list of record entries.

So **§7.1 commissions a round**, scoped to that fix, and this phase is **`SUPERSEDED BY 2d-5-3-J`,
never complete**.

**Nothing is `BLOCKED`.** No item in §7 above names an unfixed correctness defect in a source file:
items 1, 2 and 8 are marked actionable, and none of the three names a source file that is wrong in a
stated way — 1 and 2 are properties of prose this round wrote, and 8 is a tool that does not exist.
