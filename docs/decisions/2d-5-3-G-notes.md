# Phase 2d-5-3-G — the round §7.1 commissioned for 2d-5-3-F's fix

**Round 7 of the `reconciliationCoordinator.ts` review tail.** Scoped to 2d-5-3-F's fix: the one
rewritten passage closing `runOneDrain()`'s `list_documents` paragraph, `2d-5-3-F-notes.md` in full,
and the item-number and count corrections that round made to `2d-5-3-E-notes.md` and `PROGRESS.md`.

Review: [`docs/reviews/phase-2d-5-3-G.md`](../reviews/phase-2d-5-3-G.md). Verdict
**`ship-with-fixes`, 0 blockers**, 3 Medium and 2 Low. **All five were re-derived against the code by
the orchestrator before any fix was applied, and all five hold.**

**This round breaks the chain's convergence signal.** 2d-5-3-F was the first round of the tail with no
Medium, and its record read that as the first sign of convergence. It was not: this round returns
three, and **the sharpest of them is a contradiction that had been sitting inside the edited comment
block for two rounds** while both rounds' reviewers and every gate passed over it.

---

## 1. Medium 1 — one comment block asserted a proposition and its negation, and the false half was the one a work item was built on

`reconciliationCoordinator.ts`'s paragraph opening *"The workspace half of the third state is driven
and asserted in Rust"* ended with:

> So the half this arm actually rests on — that the batch's `newest_sequence` still indexes the queue
> Rust is holding — is reasoned from `WorkspaceSession::open` rather than executed …

Ten lines above it, 2d-5-3-F's own fix says **"nothing here rests on the property"**. Ten lines below
it, 2d-5-3-C's closing paragraph says the refusal is right *"in all three"* because nothing can
attribute the number, **"never that the queue is gone"**. Same proposition, opposite claims, one
comment block.

**The code settles it, and the false half is 2d-5-3-E's.** The arm is:

```ts
record(afterSequence, reasons, 'staleOpen');
return;
```

`afterSequence` is captured **before** the await — `const afterSequence = watermark;` in
`runOneDrain()`, above `await host.drain(afterSequence)` — so it is what the call *asked with*, not
what the batch answered. `batch.newest_sequence` is consumed in **`accept()` alone**
(`watermark = batch.newest_sequence`), and this arm returns above `accept()` and never reaches it. So
the arm reads no property of the batch's queue whatever; it refuses on unattributability, exactly as
the paragraphs on both sides of the false one say.

**Provenance of each half, established by `git log -S` rather than assumed**: the closing
unattributability paragraph is **2d-5-3-C**'s (`85181ac`); the false clause is **2d-5-3-E**'s
(`b1c7b4b`); the sentence that contradicts it is **2d-5-3-F**'s (`c717e9a`). So 2d-5-3-F's fix was
correct and *created the visible contradiction by being correct* — it stated the true claim beside a
false one already present, and neither that round nor its reviewer noticed the collision.

**The record instance is worse than the source one.** `2d-5-3-E-notes.md` §1 asserts the same false
clause, and its §8 item 2 — *"the queue half is unpinned and is now the only unpinned half"* — is a
**work item built on it**, whose stated fix is *"a test that drains after a refused open"*. The item
survives the correction, because the comment really does assert the queue property and nothing pins
it; what does not survive is its premise. It is a **documentation-coverage** bound, not a behavioural
one: an edit resetting the queue on the refusal path falsifies **the comment**, never the refusal.

**Fixed** in source (the clause is replaced with the true, narrower claim, naming where
`newest_sequence` is actually consumed) and in the record (a correction block on `2d-5-3-E-notes.md`
§1 and another on its §8 item 2, both carrying the correction rather than renumbering silently).

## 2. Medium 2 — the fix's central construction was load-bearing on nothing, and its unverified premise went with it

2d-5-3-F's new sentence argued that the enumeration is short by a case under the property reading like
this:

> `open()` has no re-entrancy guard, so a case-2 batch followed by a *later* open refusing at
> `Workspace::discover(root)?` leaves Rust holding the very workspace that batch came from …

**The conclusion is right and the construction is unnecessary.** In case 2 the drain lost the race, so
`WorkspaceSession::open`'s swap block has already run and the batch *is* the incoming lifecycle's
queue; nothing has replaced that lifecycle since, so Rust is still holding it and the property is
satisfied **outright**. No second open is needed to arrange it.

**The Rust makes it simpler still, and this is the part no round of the chain had read.**
`reconciliation: Arc<ReconciliationQueue>` is a field of `WorkspaceSession`, **not** of `Open`, and its
own doc comment says the queue *"is **emptied** by a replacement rather than replaced by one"*.
`guard.replace(Open { workspace, backups, watcher })` never touches it. So there is only ever **one**
queue for a session's life, and "the queue Rust is holding" identifies the same object across every
open, refused or not.

The casualty is the **`open()` has no re-entrancy guard** claim, which 2d-5-3-F's own §7 item 1 marked
as its most likely defect: it was reasoned from `workspace.svelte.ts`'s generation checks and driven by
nothing. Since it supported a step the argument does not need, it is **removed rather than re-scoped**.
A comment claim that is unverified *and* load-bearing on nothing is pure liability.

**Fixed** in source. The passage now makes the case-2 argument directly and claims no second open.

> **Correction, 2d-5-3-H — this section removed one unverified absence claim and asserted another in
> the next clause.** *"…nothing has replaced that lifecycle since, so Rust is still holding it and the
> property is satisfied **outright**"* is a guarantee the code does not give, written one sentence
> after *"`open()` has no re-entrancy guard"* was removed **for being unverified**. Same absence,
> opposite sign, and no more evidence behind it: the arm evaluates **after** the await, and a further
> successful open would install another lifecycle and empty the queue in that window — `open()` is not
> gated by the drain, and `./workspace.test.ts`'s *"lets the newer open win, however late the older one
> answers"*, in a suite named **overlapping requests**, drives two overlapping opens. What is true is
> the **time-indexed** claim: in case 2 the property held **at the instant the drain took the session
> lock**. The conclusion this section reached is unaffected — the enumeration is still short by a case
> under the property reading — because that needs the property to hold only at *some* moment in case 2.
> The source passage carries the time index as of 2d-5-3-H; this section did not.

## 3. Medium 3 — the absence claim defending it was false, and it is the same shape 2d-5-3-E raised a Medium against

`2d-5-3-F-notes.md` §7 item 1: *"**nothing in this repository drives two overlapping opens**"*.

**False.** `src/lib/browser/workspace.test.ts`'s *"lets the newer open win, however late the older one
answers"*, in a suite named **overlapping requests**, runs:

```ts
const pending = state.open(null);
await state.open('/tmp/other');
```

Two overlapping frontend `open()` calls, executed by `npm test` today. Only the **Rust-refusal** half
of the re-entrancy claim was undriven.

**This is 2d-5-3-E's Medium 1 recurring in the round that recorded it.** That finding established that
*an absence claim reads as humility and is exactly as unchecked as the citation it replaces, with the
added property that no reader is prompted to go and look.* 2d-5-3-F wrote its own, one round later, in
a section about where it is thin — and the claim was falsifiable by one `rg` in the file its own
subject module is tested beside.

**Fixed** in the record, with a correction block. The source sentence it defended is gone (§2), so
nothing in source now rests on it.

## 4. Low 1 — the replacement count is not re-derivable either, and this round asserts no number

2d-5-3-F enumerated *"six"* against 2d-5-3-D's unverified *"five"*: the module doc, the
`awaitingWorkspaceReady` doc, **three paragraphs of the `staleOpen` arm**, and `workspace.svelte.ts`'s
failed-open arm.

**"The `staleOpen` arm" does not name a set.** `runOneDrain()` has **two** arms that record
`'staleOpen'`, and the second — the `awaitingReady()` arm — contains a paragraph saying
`WorkspaceSession::open` *"may refuse at `Workspace::discover(root)?` and leave the previous workspace
installed indefinitely"*. That asserts the third state and is outside the six on **every**
disambiguation of the phrase. Counting production sites that assert the third state, this round gets
**eight**.

**No number is written down as the answer.** Five, then six, then eight is a count re-derived three
times and pinned by nothing — the **fifth** time this chain has recorded a count with no mechanism
behind it, and 2d-5-3-F's own Low 1 was that a count had been copied into the very paragraph forbidding
that. Writing "eight" would be the sixth instance. What is recorded instead is the **criterion
problem**: the predicate is ambiguous, so the figure is a function of the reader.

**Fixed** in the record (a correction block on `2d-5-3-E-notes.md` §7), asserting no figure.

> **Correction, 2d-5-3-H — this section asserts the figure it says it does not.** *"Counting production
> sites that assert the third state, this round gets **eight**"* stands four lines above *"**No number
> is written down as the answer**"* and *"Writing "eight" would be the sixth instance"*. That is a
> proposition and its negation inside one section — **the shape of this round's own Medium 1**, in the
> section written to close the count defect. The correction block it produced on `2d-5-3-E-notes.md` §7
> carries the identical pair: *"gives **eight** in production"* and *"this round asserts **no**
> figure"*. **The ruling stands and the prose did not honour it**: the criterion problem is the finding,
> so no figure belongs in either place, and a figure offered as an illustration of an ambiguous
> predicate is still a figure a later round will inherit. Neither number is re-derived here, on the same
> ruling.

## 5. Low 2 — two fresh uncounted counts in the same commit

1. The new source text said *"these three paragraphs"* — a fresh hand count, introduced by the round
   whose own finding was about hand counts. It happens to hold today (the two-case paragraph, the
   third-state paragraph, and the `list_documents` paragraph). **Removed** in §2's rewrite, which now
   says *"the paragraphs above"*.
2. `2d-5-3-E-notes.md` §7 cites `reconciliationCoordinator.ts` by **line** — `:70-71` and `:440` —
   adopted in the same commit that shifted lines in that file, against the opening-words convention
   2d-5-3-D §8 item 5 records and this chain has been converting citations to for three rounds. **Both
   resolve today**, checked; that is luck, not a guard. **Recorded** with a correction block rather
   than renumbered, because renumbering is the move that produced 2d-5-3-C's Medium 2.

> **Correction, 2d-5-3-H — the commit carried three more uncounted counts than this section names, and
> one of them is demonstrably underived.** *"The **fifth** time this chain has recorded a count with no
> mechanism behind it"* (§4), *"a **sixth** opening-words anchor"* (§7 item 5) and *"`PROGRESS.md` has
> now nominated a citation checker **five** times without one being built"* (§7 item 5) are all fresh
> hand counts, in the commit whose own Low 2 was that hand counts had been introduced by the round
> whose finding was about hand counts. The third is checkable and does not hold up: the archived
> Next-action blocks of **2d-5-3-E** and **2d-5-3-F** both say the checker has been nominated *"four
> times"*, and nothing between them and this round records a further nomination — so *"five"* is an
> increment with nothing behind it. **No replacement figure is written here**, on §4's own ruling. What
> the sweep should have looked for is the shape — *a bare ordinal or cardinal asserted about this
> chain's own history* — and not the words *"three paragraphs"*.

---

## 6. Verification

**Every figure was run, not inferred**, and the gates were run **twice** — once on the inherited tree
and once after the fix. The inherited-tree run matters because 2d-5-3-F's reviewer re-ran no gate and
inherited every figure (its §7 item 5), so an inherited figure had not been independently confirmed by
anyone for a full round.

| Gate | Inherited tree | After the fix |
|---|---|---|
| `cargo test --workspace -- --test-threads=1` | **1320**, 26 `test result` lines, none lacking `0 failed`, exit 0 | **1320**, same |
| `npm run check` (files) | — | **441** |
| `npm test` | — | **2307** |
| `npm run build` (modules) | — | **188** |
| `cargo clippy --workspace --all-targets -- -D warnings` | — | exit 0 |
| `cargo fmt --check` | — | exit 0 |
| `cargo tree -p espansoconfig-core \| rg tauri` | — | finds nothing |
| Bundle oracles | — | server-only **absent**, client-only **present** |

The three consequences of the host scar were followed on **both** cargo runs: serial form, redirected
to a file rather than read through a pipe, and the complementary question — *no `test result` line
lacking `0 failed`* — asked of all 26, because a sum can be right while a binary is silent.

**Nothing could have moved and nothing did.** The source diff is **comment-only in one file**, proven
mechanically rather than by eye: `git diff -U0` filtered to changed lines that are neither comment
lines nor blank returns **nothing**. No file entered or left the program, no new reachable module, no
new component, no new case. **No line in the edited file exceeds 90 characters**, checked with `awk`,
because 2d-5-3-C shipped a 112-character line that nothing in this repository catches.

**The instrument's pin was re-checked after the fix** and holds at `5 insertions(+), 1 deletion(-)`
across the two hook files; the four harness paths stay uncommitted.

---

## 7. Where it is thin

1. **The count is now *unstated* rather than wrong, and nothing enforces even that — *recorded only*.**
   This round declined to write a figure, which removes the defect generator without adding a guard.
   The next round can still reintroduce a count in a sentence, and no gate would notice.
2. **`workspace.test.ts`'s overlapping-open case drives the frontend and no Rust — *recorded only*.**
   It uses `scriptedCommands()`, so what it pins is `workspace.svelte.ts`'s generation superseding, not
   `WorkspaceSession::open`'s behaviour under a real second open. The Rust-refusal half of what
   2d-5-3-F claimed remains undriven; this round removed the source claim that depended on it rather
   than building coverage for it.
3. **The queue half is still pinned by nothing — *recorded only*, and now correctly classified.** After
   §1 it is a documentation-coverage bound rather than a behavioural one: an edit resetting the queue
   on the refusal path turns no test red and falsifies only the comment. §7.3 holds no step open for it.
4. **2d-5-3's able-to-fail residue (2d-5-3-D §8 item 4) is still unreproduced — *actionable*, and not a
   correctness defect in source.** **Four** consecutive rounds have now cleared none of it. Each round
   has had a reason, and four reasons in a row are a pattern rather than four coincidences.
5. **The cross-language anchor and the citation checker are unchanged — *recorded only*.** Renaming
   `a_failed_reopen_keeps_the_previous_watcher_watching` still breaks a TypeScript comment and no gate.
   `PROGRESS.md` has now nominated a citation checker five times without one being built, and this
   round added a sixth opening-words anchor (*"Which lifecycle the batch describes"*, checked and
   resolving) to the pile it would have to resolve.
6. **This round read the Rust `WorkspaceSession` struct that six previous rounds did not — *recorded
   only*.** The field placement of `reconciliation` (§2) settles what "the queue Rust is holding" means
   and had been reasoned around rather than read for the whole tail. What else in `commands.rs` these
   comments describe without anyone having opened it is not known.

---

## 8. §7.1 — a round is commissioned

**The fix changed one source file**, `src/lib/browser/reconciliationCoordinator.ts`, comment-only. Two
of the five findings were fixed there (Mediums 1 and 2, plus Low 2's first half); the other fixes are
record-only. Under `CLAUDE.md` §7.1 a fix round that changes at least one source file is owed a review
round, whatever the severity that prompted it, so:

**Phase 2d-5-3-G is `SUPERSEDED BY 2d-5-3-H`, never complete.**

**Nothing is `BLOCKED`.** No item in §7 names an unfixed correctness defect in a source file: items 1,
2, 3, 5 and 6 are *recorded only*, and item 4 is *actionable* but is a coverage residue rather than a
defect in source, exactly as the three rounds before it recorded.

**The chain did not close, and `PROGRESS.md`'s header predicted it might for the fourth round
running** — always in the same direction. That prediction should be read as a wish rather than a
figure; six of seven rounds have now found a real defect in the previous round's fix.
