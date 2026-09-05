# Phase 2d-5-3-D — the round §7.1 commissioned for 2d-5-3-C's fix

**Risk class high; worker model `opus`.** No implementation worker: the phase's product is a review
and its fix, both taken by the orchestrator. Review:
[`docs/reviews/phase-2d-5-3-D.md`](../reviews/phase-2d-5-3-D.md). Verdict **`ship-with-fixes`, 0
blockers**, 3 Medium and 1 Low. **All four were re-derived by the orchestrator against the code before
any fix was applied**, and all four are fixed.

2d-5-3-C's Next-action prose is archived in
[`next-action-history.md`](../progress-archive/next-action-history.md) under *"archived 2026-09-05 at
Phase 2d-5-3-D"*, with the two claims this round proved wrong marked **at the top of the archived
copy** rather than after it — 2d-5-2b-C's precedent.

**Scope.** §7.1 commissioned this round for 2d-5-3-C's fix and for nothing else: the four rewritten
comments in `src/lib/browser/reconciliationCoordinator.ts`, the rewritten `with_workspace_read` doc
comment in `src-tauri/src/commands.rs`, and `docs/decisions/2d-5-3-C-notes.md` with the correction
blocks it added elsewhere. The brief said in as many words: **check the comments against the code, not
the code against the comments.** That is what found all three Mediums.

---

## 1. Medium 1 — a refused `list_documents` is not the third state, and the fix that named the third state said it was

The sentence, in `runOneDrain()`'s `staleOpen` arm as 2d-5-3-C shipped it:

> *"so a refused `open_workspace`, or a refused `list_documents` after it, leaves the **previous**
> workspace installed and its queue untouched, which that function's own doc comment states in as
> many words."*

**Re-derived, not accepted.** Three readings, each taken in the file:

- `src/lib/browser/workspace.svelte.ts`'s `open()` returns on `!opened.ok` **before** it reaches
  `const listed = await commands.listDocuments();`. So a `list_documents` refusal is reachable only
  when `open_workspace` **succeeded**.
- `WorkspaceSession::open` (`src-tauri/src/commands.rs`, `pub fn open`) does `Workspace::discover(root)?`
  **outside** the lock and, on success, runs `self.reconciliation.begin_epoch(...)` and
  `guard.replace(Open { .. })` **inside one session-lock block**. A success therefore installs the new
  workspace and resets the queue to `QueueState::empty` together.
- `guard.replace` is the only writer of that slot, so nothing puts the previous workspace back
  afterwards.

So after a refused `list_documents` Rust holds the **new** workspace under a **new** epoch with an
empty queue — which is the *incoming-lifecycle* case the same comment already enumerated as its
second state, **not** a third one. Only a refused `open_workspace` reaches the third state, and it
does so precisely because `Workspace::discover(root)?` returns before the lock is taken at all.

**The irony is the finding.** The paragraph exists to say *"no reason here may be written as a
disjunction over two"*, and it widened the third state by one case that belongs to the second.

**Why it is a Medium and not a blocker.** The refusal is right in every one of the three states and
right for the reason the arm now gives (unattributability), so no execution changes. What was wrong is
a comment's claim about the code — which is this project's stated worst defect class, and a **source**
defect here.

### 1.1 What the fix says instead

The `list_documents` clause is removed from the third state and given its own paragraph, stating that
it is the *incoming* case and why — attributed to `./workspace.svelte.ts`, because the early-return
order is a property of that host and not of this line, exactly as the surrounding comment does for the
`workspaceOpened()` clear.

---

## 2. Medium 2 — the `awaitingReady()` arm's new reason is false **at that arm**

The sentence, as 2d-5-3-C shipped it:

> *"The outcome is the same as the check above's, and so is the reason: this drain was issued under a
> generation this session has left …"*

**That arm is reached only when `openedAt === host.openGeneration()`.** The arm above it returns for
exactly the case where the generation moved. So *"a generation this session has left"* is false at the
line it justifies — and the arm's **own opening sentence** says so, two sentences earlier: *"the two
checks are not the same question."*

**The fix introduced it.** The pre-`85181ac` wording was *"for a lifecycle this session has left"*,
which does not name the generation. This is the same shape the previous three rounds each found —
*the action is right and the justification names something that does not hold* — arriving this time
**inside the same comment that was rewritten to remove it**.

**What the arm now says.** The *shape* of the reason is shared with the arm above — nothing here can
attribute the batch's `newest_sequence` to a lifecycle — but the **premise is different and is stated
as different**: the generation is still the one the host reports, so what is unknown is not which
lifecycle replaced this session's, but whether the open this coordinator was *told* about has replaced
it **yet**. `WorkspaceSession::open` may not have reached its swap block, may have passed it, or may
refuse at `Workspace::discover(root)?` and leave the previous workspace installed indefinitely; the
batch's `epoch` is the only value that would separate those, and it is read **below** this arm.

The cross-reference to *"whichever of the **three** states the arm above enumerates"* is gone with it:
that enumeration is written for the case where the generation moved, which is the case this arm
excludes.

---

## 3. Medium 3 — the coverage citation names a case that drives neither the state nor any Rust

The sentence, as 2d-5-3-C shipped it:

> *"`./workspace.test.ts`'s failed-open case drives exactly that state."*

**Re-derived at `src/lib/browser/workspace.test.ts`** (*"drains for no failed open, and holds later
triggers behind the gate it left closed"*). It is false in two independent ways:

1. It scripts `open: { ok: false }` for its **only** open, so **no workspace was ever installed** to be
   left in place. That is the *gone* state, not *previous still installed*.
2. It asserts `drainSequences` stays `[0]` across the failed open and across a later wake — so **no
   batch reaches this arm in it at all**. What the case pins is the **gate**, which is a different
   claim, and its own inline comment says so.

And a third, which is why no other case could be substituted: a `scriptedCommands` vitest drives **no
Rust state**. The third state is a fact about what `WorkspaceSession::open` leaves installed, and
nothing reachable from the frontend suite can produce or observe it.

**The fix does not go looking for a better citation.** It says the true thing instead: **nothing in
this repository drives the third state and nothing here could**, the claim is reasoned from
`WorkspaceSession::open` rather than executed, and an edit to that early return therefore falsifies
the paragraph with every gate in the project green. That is the residue 2d-5-3-C recorded as unreached
(*"nothing in this repository tests and nothing can from the frontend"*), now written where a reader of
the comment meets it rather than only in a notes file.

---

## 4. The Low — the mutex-race framing contradicts this crate's own threading doc

`2d-5-3-C-notes.md` §5 reason 1 said the losing drain's thread *"is blocked on the session mutex the
swap block holds and acquires it on release."* That describes two threads contending for the lock.

`commands.rs`'s module doc **"Why every command is synchronous"** excludes it: *"Tauri runs a command
written without `async` on the main thread."* Re-derived — `rg 'pub async fn' src-tauri/src/commands.rs`
returns **nothing**, so `open_workspace` and `drain_external_changes` are both synchronous and are
serialized by the dispatcher; they never block on each other's session lock.

**The conclusion survives the mechanism.** The order is the **dispatcher's**, chosen by neither side
and read by nothing in this repository, and harm still needs the drain dispatched after the swap *and*
after epoch *N+1*'s first observation is enqueued — which waits on a fresh watcher's baseline scan.
Reason 1 now says that, with the correction marked inline.

**This is a record defect, not a source one, and the distinction was checked rather than assumed.**
The two source comments that mention the mutex — `runOneDrain()`'s staleOpen arm (*"both … reach the
same session mutex, and neither side chooses which takes it first"*) and `requestDrain()`'s JSDoc
(*"according to which reached that mutex first"*) — claim an **order**, never that either side blocks
on the other. Both are true under dispatcher serialization, and **neither was changed**.

---

## 5. The sweep, and the two places it deliberately refused to "correct"

`CLAUDE.md` says to sweep for the shape and never for the words. The shape here is *a claim that a
refused `list_documents` leaves Rust's workspace unchanged*. `rg 'list_documents|listDocuments'` over
the record and the source returns seven positions. **Two carry the false claim; five carry a different,
true one, and conflating them would have been this round's own version of the defect it is closing.**

**Carrying the false claim — both fixed:**

- `reconciliationCoordinator.ts`, the staleOpen arm (§1).
- `2d-5-3-C-notes.md` §1, which repeats it; a correction block now stands at the **top** of that
  section.

**Carrying the true claim — untouched:** `2d-5-3-notes.md` §"Every successful current `open()`" and
`2d-5-3-A-notes.md`'s two occurrences all say a refused `list_documents` leaves **`workspaceReady()`
unreached**. That is a claim about the *gate*, it is true of both refusals, and it is not what §1
corrects.

**One position was clarified rather than left or corrected.** `2d-5-3-notes.md` §"The two sequences the
round told us not to lose" lists both refusals for the gate claim (true) and then writes *"Rust keeps
the previous workspace when an open refuses"* (true only of `open_workspace`). Strictly read, *"an
open"* is `open_workspace`; in the sentence after a list of both, it is exactly the ambiguity this
chain has now been bitten by. A parenthetical marks it, states which half is being corrected and states
explicitly that the gate sentence above it is **not**. It is a record file, so §7.1 commissions nothing
for it.

**The other two rewritten comments were checked and stand.** `requestDrain()`'s JSDoc names *"the
**previous, still-installed** one when the open is refused **before that swap ever runs**"* — which is
the `open_workspace` case and says so by naming the swap. `workspaceOpened()`'s gate comment says Rust
holds the workspace *"**indefinitely** when that open is refused before the swap"* — same, and also
correct. **Neither needed the §1 fix, and neither was given it.**

### 5.1 A fifth instance, found by the orchestrator rather than the review, in `PROGRESS.md`'s own header

The checkpoint's headroom paragraph claimed **766 lines and 94,017 bytes**, described as *"measured on
the finished file rather than predicted before it"*. It was measured at **2d-5-3-B**; 2d-5-3-C then
wrote a full phase record without re-deriving it. The file this session opened was **788 lines and
98,661 bytes** — 22 lines and 4.5 KiB out, leaving **12** lines of headroom where the paragraph
promised 34.

**It is the same shape as 2d-5-3-C's Medium 2** — a derived figure outliving the thing it was derived
from — standing **in the paragraph that warns about it**, one round after the round that found the
shape elsewhere and rewrote five citations to prevent it. It was found only because this phase measured
before archiving rather than trusting the number it was handed.

**Three things were done rather than one.** The figures are re-derived and the paragraph now states the
whole arithmetic step by step. **The total is stated in exactly one place**, because a figure repeated
twice is a figure that goes stale in one. And the paragraph's own *"this file says so at line 21"* was
replaced by an anchor on the cited paragraph's opening words — a line citation into a file the record
keeps editing, in the header arguing against exactly that, and **this session moved that sentence
twice**.

**This phase's record cost 132 lines against a first archive of 130**, so a **second** archive was
taken — 67 lines of closed-chain archive arithmetic to `phase-2d.md`, with the three rules it
established kept in the live head. It was taken **because the measurement said the file had grown**,
not from a plan made in advance, and the header now says that rather than presenting it as foresight.

---

## 6. Verification — every figure run, none inferred

**`1320 / 441 / 2307 / 188`** — `cargo test --workspace -- --test-threads=1` / `npm run check` files /
`npm test` / `npm run build` modules. **Measured in full by the orchestrator twice**: once on the tree
as inherited, before any fix, and once on the tree this phase commits. That is the fifth and sixth full
run of this rung, across four phases, returning the same four figures every time.

- `cargo test --workspace -- --test-threads=1` → **1320**, summed over **26** `test result` lines *and*
  checked by the complementary question — **no line lacking `0 failed`** — because a sum can be right
  while a binary is silent. Read from a **file, never through a pipe**: all three consequences of the
  host scar were followed on both runs.
- `npm run check` → **441 files, 0 errors, 0 warnings** (both runs).
- `npm test` → **60 files, 2307 passed** (both runs).
- `npm run build` → **188 modules** (both runs).
- `cargo clippy --workspace --all-targets -- -D warnings` (exit 0), `cargo fmt --check` (exit 0),
  `cargo tree -p espansoconfig-core | rg tauri` (finds nothing) — clean on both runs.
- **Both bundle oracles read, both lines reported**, the second because it proves the search can match
  at all: server-only markers **absent**, client-only markers **present (2)**.

**Nothing moved, and nothing could have.** The source diff is **comment-only in one file** —
`src/lib/browser/reconciliationCoordinator.ts`, `numstat` **`33 11`** — proven **mechanically rather
than by eye**: `git diff -U0` filtered to changed lines that are neither comment lines nor blank
returns nothing. No file entered or left the program, no new reachable module, no new component, no new
case, so neither the one-per-module rung nor the two-per-styled-component rung has anything to apply
to. **`cargo test` was run rather than inferred anyway** — no path under `crates/` or `src-tauri/src/`
changed, which is exactly the shape that tempts an inference, and this chain's rule is that a
high-risk phase is not the place to make one.

**The instrument's pin held.** `git diff --stat` over `src-tauri/src/main.rs` and `src/main.ts` is
**`5 insertions(+), 1 deletion(-)`** — checked on the inherited tree, after the fix, and after the
final gate run.

**No line in `reconciliationCoordinator.ts` exceeds 90 characters** — checked with `awk`, because
2d-5-3-C shipped a 112-character line that nothing in this repository catches.

---

## 7. §7.1's reading — one source file changed, so a round is commissioned

The fix changed **one source file**: `src/lib/browser/reconciliationCoordinator.ts`. Its diff is
comment-only, **and the unit is the file and not the line** — `CLAUDE.md` §7 says so in as many words,
and this chain's last three rounds were each commissioned by a comment-only diff.

So **Phase 2d-5-3-D is `SUPERSEDED BY 2d-5-3-E`, never complete.** Under `/autoclaude-opus` a phase
gets **one** review invocation and this phase spent it, so that round is a new corrective phase
(`CLAUDE.md` §7.4), with its own acceptance criteria, commit and mandatory review.

**Nothing is `BLOCKED`.** No item in §8 names a correctness defect in a source file, so §7.3's blocker
clause does not apply.

**Four record files changed, and they commission nothing**: `2d-5-3-C-notes.md`, `2d-5-3-notes.md`,
`next-action-history.md` and `PROGRESS.md` are all on §7's closed list.

---

## 8. Where it is thin

Every item carries a §7.3 mark.

1. **The three-state claim is now asserted in *five* comment paragraphs and tested by none —
   *recorded only*.** This round widened the exposure rather than narrowing it: §3's fix replaced a
   false coverage citation with an explicit statement that nothing drives the state. That is honest and
   it is worse, in the sense that an edit to `WorkspaceSession::open`'s early return would falsify
   five paragraphs at once with every gate green. It names no defect in a source file — the comments
   are true today — so it is a residual risk. The durable answer is a Rust-side test of what a refused
   `open` leaves installed, which is `src-tauri/`'s business and no part of this chain's scope.

2. **The `awaitingReady()` arm is unreachable under the only production host — *recorded only*.**
   `./workspace.svelte.ts`'s `open()` bumps the generation in the statement *before*
   `workspaceOpened()`, so the arm above always fires first and this arm is reached only under an
   injected host. Its new premise (§2) is therefore reasoned and not executed. The suite pins the
   *gate*; nothing pins the *reason*. Not a defect — an arm correct for a host that does not exist yet
   is the shape this coordinator was deliberately built with.

3. **The cross-epoch watermark question is still traced and unresolved — *recorded only*.**
   `2d-5-3-C-notes.md` §5, with its reason 1 corrected here (§4). This round's reviewer narrowed it
   without settling it: `drain`'s `acknowledged.max(after_sequence)` **is** unconditional and
   epoch-blind, `begin_epoch` **does** run under the session lock so a losing drain always meets a
   fresh queue, and sequences **do** restart per epoch at `FIRST_OBSERVATION_SEQUENCE = 1`, so a stale
   `W > 0` would make the new epoch's first `W` observations refused **and counted**. What is
   unsettled is whether the losing dispatch order occurs at all, which under the main-thread model is
   Tauri's dispatch order and is readable from nothing in this repository. **It is marked *recorded
   only* deliberately and the reasoning is stated rather than asserted**: §7.3 makes an item a blocker
   when it names a correctness defect in a source file, and this names a *risk* whose reachability is
   unestablished — it cannot be written as *"this file is wrong in this way"*. A real fix is a wire
   change (`drain` has no caller-epoch parameter) and belongs to **2d-5-5**, which is a phase decision
   and not a tail.

4. **Phase 2d-5-3's able-to-fail claims for seven of its eight cases, and its §8.3 five-failure
   transcript, are still unreproduced — *actionable*, and not a correctness defect in source.** The
   residue has shrunk by one per round (three at 2d-5-3-A, four by its reviewer, one at 2d-5-3-B, one
   at 2d-5-3-C) and **this round cleared none** — its three Mediums all needed re-derivation against
   Rust, and the mutation budget went there instead. A later step may adopt it; it holds no step open.

5. **The citation-by-opening-words convention has nothing enforcing it — *actionable*, in the
   record.** 2d-5-3-C adopted it in five positions after three demonstrations that a line citation into
   a file the record keeps editing does not survive its own commit, and this round added more of the
   same form. **No round has yet checked whether the anchors themselves still match** — an anchor is
   robust against renumbering, not against a rewording, and this round reworded two of the anchored
   comments. The durable alternative `PROGRESS.md` has now nominated three times — a checker that
   resolves `file:line` references in comments — is still unbuilt, and it would also discharge the four
   stale cross-file citations under `src/` that the 2d-5-2b chain left live.

6. **This round reviewed the record half of its scope less hard than the source half — *recorded
   only*.** `2d-5-3-C-notes.md` is 250 lines and the brief put it in scope in full; the reviewer's
   findings against it are one Low and one repetition of a source finding. That is a plausible verdict
   for a notes file written the same day by an orchestrator that re-derived everything — but it is
   also what a shallow pass would produce, and the two are not distinguishable from this record.
