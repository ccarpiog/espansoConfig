# Phase 2d-5-4-B — the round `CLAUDE.md` §7.1 commissioned for 2d-5-4-A's fix

**Status: taken and answered.** Risk class: **high**. Components: **none** — no `.svelte` file was
modified, so no window reading is owed.

This is **not** an implementation step. §7.1: *a fix round that changes at least one source file is
owed a review round, scoped to that change.* Phase 2d-5-4-A's fix changed four source files; this is
the round that reviews **that fix**, and this file records what the round found and what was done
about it.

The documents: the brief [`docs/reviews/phase-2d-5-4-B.brief.md`](../reviews/phase-2d-5-4-B.brief.md),
the review [`docs/reviews/phase-2d-5-4-B.md`](../reviews/phase-2d-5-4-B.md), and the re-derivation
[`docs/reviews/phase-2d-5-4-B.rederivation.md`](../reviews/phase-2d-5-4-B.rederivation.md).

---

## 1. How the round was run

**The review was Codex**, verdict `ship-with-fixes`, **6 findings: 2 blockers and 4 SHOULD-FIX**, over
the committed fix `ee78429`.

**The report's finding bodies arrive truncated again** — 180 characters, each one breaking off
mid-sentence — so the same three-stage shape as 2d-5-4-A was used and **not one finding was accepted on
the report's strength**:

1. a **read-only re-derivation worker** derived each finding's mechanism from the source alone and
   wrote it to the `.rederivation.md` file above, **correcting the reviewer's line numbers** where they
   were wrong (finding 3 anchors at `2963`, a comment line; the statement is at `2966`. Finding 4
   anchors at `2339`, the status-write check; the caller-controlled read is at `2343`);
2. the **orchestrator spot-checked the decisive lines of five of the six** against the files;
3. this fix round implemented the six fixes **plus three things the review missed and the
   re-derivation found**, and pinned each source fix with a case confirmed against the pre-fix code.

**All six held.** Five are defects in source; the sixth is record-only. The three the review missed are
§4's ingress class, §5's second write, and §7's wrong mark — each of them a generalization of a finding
the review had already made, which is the shape `CLAUDE.md` calls *sweep for what the type now says,
not for the words of the finding you just closed*.

---

## 2. Finding 1 — `open()` published after running the caller's code

**What was wrong.** `open()` compares its generation at the **top** of every loop iteration and then,
inside the body, runs caller-controlled code: `ownedProjectionOf(view.value)` reads `value`, then
`matches`, then twenty-four fields and each match's eighteen, and the failure arm calls the **injected**
`report`. For iterations 1…*n*−1 that is covered — iteration *i*'s getters are caught by iteration
*i*+1's comparison. **The last iteration has no next one**, and between its reads and
`views = projected; loadFailures = refused; status = 'ready'; reconciliation.workspaceReady();` there
was nothing at all.

So a getter on the final document's answer that synchronously called `state.open(root2)` blanked the
window for a new root, returned at that call's first `await`, and then watched the superseded load
install the **previous** configuration's projections and call them `ready` — with `workspaceReady()`
opening the coordinator's drain gate for a lifecycle nothing on screen belongs to. This is the exact
inversion of what `ownedProjectionOf`'s own header promises: *the getters run before the comparisons
that decide whether the answer may be installed, and never between one of those comparisons and the
install it approved*.

**The fix.** A final `generation !== openGeneration` comparison after the loop and immediately before
the publication, with the per-iteration one kept. Its comment says what it catches that the
per-iteration one cannot, and the in-loop comment no longer implies that the copy is itself covered by
the check above it — it says which comparison covers it, and that the `else` arm is caller code too
because `report` is injected.

**What the fix does not claim.** It does not make the loop body atomic, and it does not make `open()`
re-entrant. A getter can still run a second `open()` to completion; what changed is that the first one
publishes nothing afterwards. It also says nothing about the *other* asynchronous entry points — they
take their own captures and are unchanged.

---

## 3. Finding 2 — the identity object was still the command's, and it is read between a guard and its write

**What was wrong.** `ownedMatchOf` wrote `id: match.id`, retaining the command's `MatchId` whole, and
its own header said so as a disclaimer. The disclaimer was not a safe one: `positionOf` in
`src/lib/browser/selection.ts` compares `match.id.node` — a **third-level** read, one below where the
copy stopped — and `positionInSameParse` calls it at three adoption sites, **between the
selection-follow guard and the `replaceSelection` that guard justifies**:

- `adoptTheDocumentOnDisk` — guard on `selected`, `selected.document` and `isTheSameIdentity(selected.id,
  target)`, then the lookup, then the write;
- `adoptTheCreatedSnippet` — guard on `selected === heldBefore` and the sidebar scope, then the lookup,
  then the write;
- `adoptAfterTheDuplicate` — guard on `selected === intent.held` and `selectGeneration ===
  intent.generation`, then the lookup, then the write.

A getter on one of those retained identities is arbitrary code inside that window, so the clone or the
moved snippet hijacks a selection the person moved — 2c-3c step 2's High in its third-level form. The
third site even carries a comment defending itself: *"no await separates them from the
`replaceSelection` they justify"*, which is literally true about **awaits** and silent about the rule
`CLAUDE.md` actually states, that a check and a spend separated by **any property read** are not atomic.

**The fix.** `ownedMatchIdOf` constructs a `MatchId` field by field, explicitly typed, and
`ownedMatchOf` uses it. Beside it, `ownedIdentityOf` is the same copy for an identity that may be
absent, and the **audit the brief asked for** applied it to the other identity inputs on those paths:
`target` and `moved` both arrive from a command's save answer, and both are now copied at the **first
statement** of each adoption, before its only `await`, so their accessors run before the guard rather
than inside it. Every later use in those functions is of the local. `adoptAfterTheDeletion` needs
nothing: it reads no command-supplied identity, only a `SelectedMatch` this module built.

Three records were corrected with it:

- **`ownedProjectionOf`'s reader enumeration** listed four readers and missed the fifth,
  `positionInSameParse` → `positionOf`, which is the one that reads deepest. It now lists five, and the
  depth sentence matches what the code copies — *two levels, plus one field at the third*.
- **`select()` is named rather than changed.** It reads `match.id.document` too, and it takes its intent
  and projection captures **after** that read. That is the right order, so it needs no copy, and the
  header says so explicitly rather than leaving the next reader to wonder why one third-level read is
  fine and another is not.
- **The compile-time claim now carries its caveat.** A field-by-field copy makes a **required**
  member's omission a compile error and an **optional** member's omission nothing at all, because an
  object literal that omits a `?` property still satisfies the type. `MatchView`, `DocumentView` and
  `MatchId` have **no** optional member today, which is why the claim holds as written; nothing
  enforces that they never gain one, and the header says that too.

**What the fix does not claim.** The fourth level and below is still the command's own object — the
values of `trigger`, `content`, `options`, and the elements of the arrays — and **no type expresses
any of this**. What makes the claim true is `ownedProjectionOf` running at every ingress, which is a
review-enforced invariant over a list of call sites, not a compiler-enforced one.

> **Correction (Phase 2d-5-4-C, review finding 1).** The paragraph above answers *how deep* and reads
> as though it also answered *at which ingresses*, and the second question was open: one retained
> `MatchId` was **not** reached by this round's copy. `ownedRepair` passed a kept selection repair's
> `selected` through unchanged, and `reresolve` fills that value's `id` **by reference** from the
> projection `commands.reloadDocument` answered with — so the identity the window then held for the
> rest of the session was the command's own object, read by `isTheSameIdentity` as the last conjunct
> of the three selection-follow guards this very section is about. The fix is one more call of this
> round's own `ownedMatchIdOf`, at that ingress; see `docs/decisions/2d-5-4-C-notes.md` §1. The
> sentence to carry forward is about the **list of ingresses**, which is what nothing enforces.

---

## 3a. Finding 3 — an explicit reread cleared a status a newer observation had set

**Numbered `3a` and not `4`, because renumbering would falsify the twenty §N cross-references this
file already carries.** The omission is the record's, not the fix's: finding 3 was implemented and
pinned in this round like the other four, and only its section was missing until the orchestrator's
review of this file before the commit.

**What was wrong.** `rereadUnderGuard` ends by clearing the file's status — 2d-5-4-A moved that clear
out of the coordinator's guard and into the installation block precisely so that **both** of the
helper's callers reach it. `BrowserState.rereadDocument` is the second caller and it passes
`ALWAYS_PERMITTED`, so on that path **nothing asks whether this read still owns the status**. Start an
explicit reread, hold its successful response, and accept a newer `Unreadable` observation for the
same file meanwhile: `applyUnreadable` marks the document `unavailable` and advances the accepted
sequence, and the held answer then installs and **clears the mark somebody else had just set**. The
observation is never redelivered, so nothing restores it for the rest of the session.

**The fix is a fourth capture, and it fences the clear alone.** `statusWriteOf(document)` is taken at
`workspace.svelte.ts:3059`, beside the three captures the guard already took, and the clear at `3130`
runs only while that token is unchanged. Two structural properties of 2d-5-4-A survive and are
restated in the comment rather than assumed: the clear is **still inside the installation block**, and
**no arm that refuses clears anything** — the fence can only ever suppress the clear, never move it to
an arm that returned early.

**What the fix does not claim, and the choice it makes.** The **install is deliberately left
unfenced**. A read that really landed answers with bytes that really were on disk, and installing them
under a newer mark leaves the window showing older content beside a status that correctly says the
file could not be read — which is what *stale* means here and is never worse than what shipped. The
alternative, refusing the install too, would throw away a successful read on the strength of an
observation about a **later** state of the file. A `Removed` is a different question and is already
fenced elsewhere: `removeDocumentFromWindow` bumps the projection generation, which the guard's own
captures compare.

---

## 4. Finding 4, and the first thing the review missed — `DocumentSummary` was a whole unnormalized ingress

**What was wrong.** The host's failure arm gained three fence checks at 2d-5-4-A — the open
generation, this file's status-write token, and whether the window still holds a row for it — and its
JSDoc says *the write happens only while all three say this arm still owns what that file's status
says*. It did not: the **third** check is `documents.some((held) => held.id === document)`, a property
read on caller-supplied data, and it runs **after** the other two and **before** the write. The one
condition that can invalidate the two above it was the one running foreign code.

**The class, which the review named only through this one symptom.** `documents` is a second whole
ingress and nothing normalized it: `list_documents`' answer was assigned straight across, and
`addDocument` retained the summary an `Added` observation carried. Its elements are read by everything
that draws a row, picks the viewer's target or answers a coordinator question — including
`creatorEligibility`, which runs **inside the coordinator's own guard** and is finding 5's vector.

**The fix is at ingress, as this round's precedent demands.** `ownedSummaryOf` copies a summary field
by field, explicitly typed `DocumentSummary`, with the same compile-error property and the same
optional-member caveat; `open()` copies row by row into an array this module built, and `addDocument`
copies before it retains. The failure arm's comment now says that its last read before the write is
data this module wrote, and why the check that can invalidate the checks above it has to be the one
that runs no foreign code.

**What the fix does not claim.** `DocumentSummary` is one level deep — every member is a `number`, a
`string` or a `boolean` — so unlike `ownedProjectionOf` this copy needs no depth disclaimer and makes
no promise about a second level, there being none. It also does not make the three fence checks
atomic with the write in any stronger sense: they are now separated from it only by reads of this
module's own data, which is the most the shape can give.

---

## 5. Finding 5, and the second thing the review missed — the positional argument was false at two sites

**What was wrong.** The two arms of the coordinator's guard **below** the ownership question wrote
`stale` directly, defended by *reaching this line means the ownership question two arms up already
answered yes*. It answered yes **then**. Between `sequences.isNewest(document, route.sequence)` and
either write, `tellTheSurfaceAbout` calls `workspace.openWriteSurfaces()` and
`workspace.creatorEligibility(route.document)` — host members, and the second walks this window's row
list. A host whose accessor admits a newer observation for the same file makes those arms write `stale`
over the newer transition's verdict, which is exactly what `markStaleWhileOurs` was introduced at
2d-5-4-A to stop for the two arms **above**.

**The review named one write; there are two.** `observationTransitions.ts`'s registry arm is the one it
anchored on, and `tellTheSurfaceAbout`'s own `stale` carries the identical exposure — it is after the
same two host reads, it is reachable from **both** of that function's call sites, and it was defended
by the same sentence one arm up.

**The fix routes both through the ownership question.** `markStaleWhileOurs` is hoisted out of the
guard into `applyChange`'s body and **passed into `tellTheSurfaceAbout` as a parameter** rather than
duplicated there, ~~so this module has exactly one fenced status writer for an admitted `Changed` and a
reader can see that every `stale` such an observation produces goes through it~~. Both positional
justifications are deleted, including the claim that *a `markStaleWhileOurs()` here would be a call
that can never refuse, and no test could tell it from this one* — §6's two new cases refuse it.

> **Correction (Phase 2d-5-4-D).** The struck half was already false when it was written, in the two
> ways §10 item 6's correction names: `workspace.svelte.ts`'s reread member wrote a `stale` for an
> admitted `Changed` without going through this writer, and `applyNamedRow` writes another from a
> different function. §10 item 6 retracted it for the **source comment** that stated the same thing;
> this is the body sentence it came from, and it is struck here rather than reworded, because what is
> true now is the narrower claim already recorded there — the host's initial mark is fenced by the
> ownership question `applyChange` hands it, and `applyNamedRow` carries its own fenced writer.

**`markStaleWhileOurs`'s own JSDoc is corrected with it.** It called `sequences.isNewest` *a pure read
of the accepted-sequence map*. `AcceptedSequences` is an **interface** and `isNewest` is a declaration;
the only implementation today — the closure `createAcceptedSequences()` returns — is a `Map` lookup and
is pure. That is a property of **that implementation and not of the type**, and the header now says so.

**What the fix does not claim.** It does not reorder the guard: `stillApplying` is still first, because
the arm below it fires a component's callback, and that ordering is 2d-5-4's blocker 2. It does not
stop a host member from running arbitrary code — nothing here can — it only stops the result of a
question asked before that code from being spent after it. And the delivery to the surface is
deliberately **not** fenced: refusing it would drop a conflict a component is entitled to see; only the
status write is.

---

## 6. Finding 6 — the record said nine and enumerated eight

**Record only.** `docs/decisions/2d-5-4-A-notes.md` captioned a table as *"the nine cases"*. Four
different quantities were collapsed into that one word, and the correction block now added there
distinguishes them, each counted independently from `git show ee78429` and from the rows rather than
taken from the reviewer:

| The quantity | The number |
|---|---|
| `it(` blocks added | **10** (6 + 4) |
| `it(` blocks deleted | **1** — a rewrite, not a new case |
| Net new tests | **+9** (2380 → 2389) |
| Rows in the §6 table | **7** |
| Discriminating cases those rows name | **8** — the epoch row names two |
| Candidates discarded for passing both ways | **2** |

"Nine" is a true statement about the **suite's size** used as a caption for a table of eight, which is
what made the count unverifiable from the table it captioned.

---

## 7. The third thing the review missed — a *recorded only* mark on a correctness defect in source

`docs/decisions/2d-5-4-notes.md` §7 item 12's round-2 correction block closes with *"What survives as
**recorded only** is the residue — the third level and below is still the command's own object, and no
type says so."*

Under `CLAUDE.md` §7.3 that mark is **wrong**, and it is wrong in the one place where the mark decides
whether a known defect closes with the step. *Recorded only* is for a residual risk that names no defect
in a source file; the residue named one — §3 above is that defect, read after a guard and between a
check and a spend at three sites — so the correct mark was **blocker**: fixed now, or the step held
open and marked `BLOCKED`. Had it been marked correctly, 2d-5-4 could not have closed with it.

A marked correction block now says so in that file and names §3's change as what closes it, and states
~~the **narrower** thing that genuinely survives as *recorded only*: the **fourth** level and below is
still the command's own object, and nothing this module reads after a guard goes that deep.~~

> **Correction (Phase 2d-5-4-C, its M1).** The struck clause is this section's own finding recurring
> one wording narrower: *nothing this module reads after a guard goes that deep* was false when it was
> written, because `ownedRepair`'s kept arm retained a third-level `MatchId` that a guard reads. The
> block this section wrote into `2d-5-4-notes.md` has been corrected there, and the same claim standing
> in **source** — `ownedRepair`'s header in `workspace.svelte.ts`, at 709-712 until that rewrite
> moved the text those lines hold, which also misattributed `ownedMatchOf`'s *`id` is the one
> exception* — is rewritten. Sweeping for the previous wording is what produced this instance, and
> the sweep this round ran was by shape: every writer of `selected`, and every producer of a
> `SelectedMatch`.

Two neighbouring record defects the re-derivation found were corrected at the same time rather than
left as narrower instances of a finding just closed:

- **`2d-5-4-A-notes.md` §7 item 1** put the incomplete-enumeration risk in the future — *"a reader added
  later … makes the sentence false"* — when a fifth reader was already there when that sentence was
  written.
- **`2d-5-4-A-notes.md` §3** carried §6's discarded-candidate claim in its own words (*"fenced by
  position: a call that can never refuse is one no test can tell from no call"*). Fixing only §6 would
  have left the identical false claim standing one section up, which is the failure mode `CLAUDE.md`
  records for the 2c-4a-3a round.

---

## 8. §6's other half — `2d-5-4-A-notes.md`'s discarded-candidate sentence is false

That file's §6 says two candidates were discarded for passing both ways, and explains the first:
*"a fence on the guard's registry arm cannot discriminate, because `isNewest` returns first — which is
the positional argument of §3 stated as a measurement"*.

Finding 5 disproves it. A fence there **does** discriminate, because `tellTheSurfaceAbout` runs two host
members between the question and the write, and `applyChange` takes the workspace **and** the sequence
map as parameters — so a test can inject a `creatorEligibility` that admits a newer observation without
any private hook. §6 below is the measurement. A marked correction block now stands in that file,
saying what the discarded candidate actually measured: **the absence of such a host in the test, not the
absence of the case.** That is the general hazard the block names — a draft case that does not
discriminate is evidence about the draft, and promoting it to *no case can* turns a failed attempt into
a licence.

---

## 9. What this round deliberately did not do

- **No user-facing string in any language**, so no dictionary key and no i18n parity question.
- **No `.svelte` file**, so no window reading is owed.
- **No Rust.** `git diff --numstat -- crates/ src-tauri/` names only the instrument's `main.rs` hook.
- **No new module.** `ownedMatchIdOf`, `ownedIdentityOf` and `ownedSummaryOf` live in
  `workspace.svelte.ts` beside the state they protect, so the ladder's *one module per new source
  module* rule predicts no movement in `npm run build`.
- **No fourth-level copy.** The residue §7 re-marks is closed exactly as deep as something reads it
  after a guard, and no deeper. A blanket deep clone remains rejected for `2d-5-4-notes.md` §7 item 12's
  own reasons — heavy, throwing on non-cloneable values, and a change to the identity of the installed
  projection.
- **No change to the guard's decision order**, and no fence on the surface delivery itself (§5).
- **No `cargo` command of any kind was run**, by instruction: this round changed no Rust.

---

## 10. The gates

**The four gate figures are `TBD (the orchestrator measures these)`** — `cargo test --workspace`,
`npm run check` files, `npm test` and `npm run build` modules. Everything below is what **this round**
measured while working, and is evidence about the fix rather than the gate. **No `cargo` command of any
kind was run.**

**Every source fix was confirmed against the pre-fix code** by reverting the change in the tree, running
the one suite, recording the message and restoring it. Six cases over the five source fixes:

| Fix | The case | What it said before the fix |
|---|---|---|
| 1 | `workspace.test.ts` — *publishes nothing when the last file's own getter opens another workspace* | `expected 'ready' to be 'loading'` |
| 2 | `workspace.test.ts` — *does not follow the move past a selection an identity's own getter dropped* | `expected { id: { document: 2, …(2) }, …(3) } to be null` |
| 3 | `workspace.test.ts` — *keeps a newer unreadable reason an explicit reread did not set* | `expected null to deeply equal { kind: 'unavailable', …(1) }` |
| 4 | `workspace.test.ts` — *reads no summary of its own between the failure arm's checks and its write* | `expected 2 to be +0`, and the file's `afterEach` drain assertion beside it: `expected 3 to be 2` |
| 5 | `observationTransitions.test.ts` — *writes no stale when the host read that chose the surface admitted a newer one* | `expected [ { document: 1, status: { …(1) } } ] to deeply equal []` |
| 5 | `observationTransitions.test.ts` — *writes no stale on the registry arm when a host read admitted a newer one* | `expected [ { document: 1, status: { …(1) } } ] to deeply equal []` |

Finding 5 carries **two** cases because the fix changed two writes, and a case driving one of them says
nothing about the other — which is the whole reason the review's single anchor was not enough.

**Non-discriminating assertions, named where they stand.** Three assertions in these cases pass both
ways and are kept because they establish that a trap is live rather than decorative. Each is stated in
the case itself so no reader mistakes it for the measurement:

- fix 1's `expect(sprung).toBe(true)` and `expect(opens).toBe(2)` — **measured**: both passed against the
  pre-fix code, which is how it is known the getter really fired there;
- fix 4's `expect(state.externalDocumentStatus(2)).toEqual({ kind: 'stale' })` — **measured** by placing
  it *above* the discriminating assertions and re-running the pre-fix tree: it passed, and the case
  broke on `reads`. ~~`2d-5-4-A-notes.md` §7 item 4 already records why it cannot discriminate — a write
  this fence permits can only restate the arm's own mark.~~

  > **Correction (Phase 2d-5-4-C, review finding 2).** The measurement stands; the cited reason is the
  > incomplete one. A write that fence permits cannot change *this* file's status **value**, and it did
  > change who owned it — `noteDocumentStatus` bumps the ownership token unconditionally — so a case
  > with a **second, overlapping** read in it discriminates on a value after all. The arm is deleted at
  > 2d-5-4-C, so this case no longer tells a fence from its absence; it has been re-pointed at
  > `creatorEligibility`, the reader inside the coordinator's guard that `ownedSummaryOf`'s header
  > names first and that is still there, and re-confirmed to fail without the ingress copy.

**Candidates discarded, and how.** Three shapes for finding 4 were rejected **at design time, by
reasoning and not by running them**, and that distinction is recorded rather than blurred: a
status-value assertion after a trap that re-enters `open()` (the value is `stale` on both sides, for
the reason above); a trap that lies about its `id` so the membership test refuses (the status before
that test is necessarily this arm's own `stale`, because the *second* check guarantees nothing has
written since, so a refusal and a restatement leave the same value); and a re-entrant
`rereadDocument` whose install would show through (it measures the re-entrant read, not the fence).
The case that shipped asserts the read count and the `open_workspace` count, and both were measured.
**Nothing was run and found to pass both ways in this round** — the two candidates that were are
2d-5-4-A's, recorded there.

**What the fix round ran, post-fix, as a working check and not as the gate:** `npx vitest run
src/lib/browser/workspace.test.ts src/lib/browser/observationTransitions.test.ts` → **266 passed**,
exit 0 (221 + 45); `npx vitest run` → **2395 passed in 61 files**, exit 0, which is 2389 plus the six
cases above; `npm run check` → **443 files, 0 errors, 0 warnings**, exit 0. The orchestrator's own
measurement is what the gate line records.

**The instrument's pin:** `git diff --stat` over `src-tauri/src/main.rs` and `src/main.ts` is still
`5 insertions(+), 1 deletion(-)`, and `src-tauri/src/probe.rs` and `src/probe.ts` are untouched.

---

## 11. Where it is thin

Every item carries one of §7.3's two marks. **No item commissions a round** — §7.1 is the only
mechanism and it reads a diff — and **no item below names an unfixed correctness defect in a source
file**, so none holds this step open.

1. **recorded only** — the normalization invariant now spans the projection copy, the identity copy and
   the summary copy, over **eleven** ingresses (nine projection, two summary) plus **four** identity
   copies inside the adoptions — `target` and `moved` in `adoptTheDocumentOnDisk`, `moved` in each of
   the other two — and **no type expresses any of it**. A twelfth ingress added later would not fail to
   compile. This is
   2d-5-4-A §7 item 6 widened by this round rather than closed by it, and widening it is the cost of
   fixing at ingress; the alternative — fixing at each guard — is what both rounds rejected.
2. **actionable** — `ownedProjectionOf`'s reader enumeration now names five readers and was derived by
   sweeping the call sites by hand. 2d-5-4-A §7 item 1 predicted a sixth would falsify it silently, and
   this round found the fifth exactly that way, so the prediction has a measurement behind it now. The
   check that bites is the same one: sweep every statement between a guard and the write it approves,
   at each of the sites, and compare against the list. Nothing runs it.
3. **recorded only** — the required/optional caveat is now written down in three headers and enforced
   nowhere. A `?` added to `MatchView`, `DocumentView`, `MatchId` or `DocumentSummary` silently weakens
   all four copies. A lint or a type-level exhaustiveness helper would bite; neither exists here.
4. **recorded only** — `rereadUnderGuard`'s new status capture fences **the clear and not the install**,
   deliberately, and the two claims differ in a way only prose states. Nothing tests the install half of
   that decision, because there is nothing to observe: the install is what it always was.
5. **recorded only** — ~~fix 4's discriminating assertions are a read count and a command count rather
   than a value, because the fence's permitted write cannot change a value (§10). A future edit that
   made the fence's third check read foreign data again *and* removed the trap's ability to re-enter
   would pass this case. The case pins the shape that exists, not every shape that would be wrong.~~

   > **Correction (Phase 2d-5-4-C, review finding 2).** *The fence's permitted write cannot change a
   > value* is the sentence that hid finding 2 through three rounds: it cannot change **this file's
   > status value**, and it does advance the ownership token, which a second overlapping read then
   > loses on. The arm and its fence are gone, and fix 4's case has been re-pointed at the coordinator's
   > guard — see the correction in §10.
6. **recorded only** — `applyChange`'s `markStaleWhileOurs` is now shared by the guard's three refusing
   arms and by `tellTheSurfaceAbout`, which two call sites reach, and nothing stops a further writer
   being added beside it rather than through it. `noteDocumentStatus` is on the
   `ReconciliationWorkspace` interface, so it is reachable directly from anywhere in this module; the
   single-writer property is a convention, not a type.

   > **Correction (Phase 2d-5-4-C, review finding 4).** This item records the risk in the future tense
   > and the **source comment beside the writer stated the convention as a fact** — *"this module has
   > exactly one fenced status writer and a reader can see that every `stale` an admitted `Changed`
   > produces goes through it"* — which was already false when it was written, in two ways:
   > `workspace.svelte.ts`'s reread member wrote a `stale` for an admitted `Changed` and did not go
   > through it, and `applyNamedRow` writes another from a different function. Both are closed rather
   > than re-worded — the host's initial mark is now fenced by the ownership question `applyChange`
   > hands it, and `applyNamedRow` carries its own fenced writer — and the comment now says what is
   > true of the code. See `docs/decisions/2d-5-4-C-notes.md` §4 and §8.
7. **recorded only** — this round changed no `.svelte` file and takes no window reading, but what it
   changed — when a file is marked stale, when the mark clears, and which of two overlapping truths
   wins — is exactly what 2d-6 draws. The first reading that draws it is the first evidence any of it is
   right on a screen.
8. **recorded only** — the `Unreadable` arm of a `Changed` observation writes its status at
   `applyChange`'s second statement, after `'Unreadable' in route.content` — a read on the wire value
   the drain supplied. ~~It is not in scope here and it is not the same shape as findings 4 and 5, because
   nothing is *checked* before it that the read could invalidate: it is the first write of that arm.~~
   Named because a reader sweeping this module for property reads will meet it.

   > **Correction (Phase 2d-5-4-C, its M4).** The struck justification is not true of the code.
   > `sequences.admit(document, route.sequence)` **is** checked before it — it is the first statement of
   > the function — and *the first write of that arm* is not the same thing as *the first statement
   > after a check*. `'Unreadable' in route.content` is a `has` on a wire value and
   > `route.content.Unreadable.reason` is a getter read on one, so both run between that check and this
   > write. The exposure really was the narrowest on the table, and the stated reason was the wrong one,
   > which made the item a record defect rather than the residual it presented itself as. Fixed: the
   > reason is read first and the write goes through the same fenced writer as every other status this
   > function records. The same sweep found and fixed three more of the shape — `applyAddition`,
   > `applyRemoval` and `applyNamedRow` — and left `applyUnreadable` alone with a justification that is
   > a statement about its code. See `docs/decisions/2d-5-4-C-notes.md` §8.
