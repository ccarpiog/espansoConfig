# Phase 2d-5-1-A — the two source fixes Phase 2d-5-1's review cap could not carry

**Status: implemented; its own review is what closes it.** This phase exists for one reason, and the
reason is a rule rather than a preference: `CLAUDE.md` §7.4 says that **a source fix a review cap
leaves unreviewed becomes a new corrective phase carrying that review**, with its own acceptance
criteria, its own commit and its own mandatory review — never a fix that ships unreviewed under a
phase called complete.

[`docs/reviews/phase-2d-5-1.md`](../reviews/phase-2d-5-1.md) returned four should-fix findings and no
blocker. Two named this project's record and were fixed at 2d-5-1 itself, where a prose-only fix
commissions nothing (§7.1). The other two named **source** files —
`src/lib/browser/restore.test.ts` and `src/lib/browser/restore.ts` — so fixing them there would have
commissioned a round that 2d-5-1's single review invocation could no longer run.
[`2d-5-1-notes.md`](2d-5-1-notes.md) §7 is the disposition table that carried them here.

**Two source fixes and their evidence, and nothing else.** No registry, no coordinator, no drain
pump, no observation transitions, no production import of `src/lib/ipc/events.ts`, no component
change and nothing under `crates/` or `src-tauri/`. Both `never` termini stay and stay exhaustive.

---

## 1. Files

| File | What changed |
|---|---|
| `src/lib/browser/restore.ts` | `targetingSurfaceFor` prefers an exact document match; its doc comment says what that ordering does and does not guarantee |
| `src/lib/browser/restore.test.ts` | the `coordinator()` recorder now models production, through a new named helper; **+3 cases** (218 → 221) |

No file was added, so `npm run check`'s file count and `npm run build`'s module count are both
unchanged by construction, and `scripts/lint/ipc-detail.test.ts` — whose `it.each(scannableFiles())`
enrols files rather than cases — did not move. §4 measures all of that rather than asserting it.

---

## 2. Finding 1 — the `coordinator()` recorder, and the decision taken

### 2.1 What it was

2d-5-1 widened `OpenWriteSurface` so a `matchCreator` may carry `target: { kind: 'unknown' }`. The
recorder in `restore.test.ts` filtered its open list with `surface.document !==
invalidation.document`, which no longer compiles over the union, and the rewrite it was given kept a
surface whose target is `unknown` **open** across an invalidation — on the recorded ground that *a
form that names no file is not over the replaced one*.

### 2.2 The decision: the helper models production, and production is the other way round

**Decided: make the helper model production.** The ground the old filter gave is a real argument, and
production has already heard it and ruled the other way. `invalidateEverySurface` in
`src/lib/components/DetailPane.svelte` sets `creating = false` **unconditionally**, and its own
comment at `:529-535` says why in as many words: that pane *cannot learn which file the form chose*,
so it closes the form over every file — which over-broadly includes the file it names nothing about.
The comment names the direction as deliberate: over-broad **is** the conservative direction here,
because a form left open over a replaced file holds a position anchor that names nothing.

So the two were not two defensible policies; they were production's rule and a test helper asserting
its negation. The review graded it inert and it is — nothing in the suite drives an unknown-target
creator through `close()`, because no production caller constructs one yet — but 2d-5-2 is precisely
the step that starts constructing them, and it would have found a helper already agreeing with the
wrong answer.

### 2.3 What shipped

`closedByReplacementOf(surface, replaced)` is a new named helper in `restore.test.ts`, and the
recorder's `close()` filters through it. It is the three rules `invalidateEverySurface` actually has:

1. a `matchCreator` is closed **whatever file it names**, `unknown` included;
2. a `restore` surface is **not** closed — `DetailPane.svelte:525-527` is the deliberate exemption,
   because the restore pane is where the outcome of this very write is drawn;
3. every other kind closes on an exact match of the replaced file, which is that function's five
   identity comparisons.

**Rule 2 was not in the finding, and it was fixed anyway** — for the finding's own reason. The old
recorder closed a restore surface over the replaced file, which is a second place where the helper
modelled production backwards. Leaving it while correcting rule 1 would have shipped a helper whose
comment claims to model production and does not, which is the same trap one arm along.

**Why a named function rather than a longer arrow.** The rule now has three arms and a paragraph of
justification each; inlining it would have put the justification in a comment beside a filter
expression, where the next rewrite loses it. The name is what a case's failure message points at.

### 2.4 The cases that drive it, because the fix is otherwise unobservable

**Two new cases, and both were measured to fail on a revert** rather than assumed to:

- *closes a new-snippet form that has named no file, because that pane does* — drives an
  `unknown`-target creator, a `document`-target creator over another file and a match editor over
  another file through one committed invalidation. Both creators go; the editor stays.
- *leaves the restore surface itself open, which is the other half of that rule* — drives a `restore`
  surface and a raw editor, both over the replaced file. The raw editor goes; the restore stays.

Measured: with `closedByReplacementOf` reverted to the old document-only filter, `npx vitest run
src/lib/browser/restore.test.ts` reports **2 failed | 219 passed**, naming exactly those two cases.
Restored, it reports **221 passed**.

### 2.5 What this does not guarantee, in the same sentence as what it does

**Nothing relates the helper to the function it models.** No type, no test and no lint connects
`closedByReplacementOf` to `invalidateEverySurface`; if production changes its rule, this helper goes
silently stale and every case written against it keeps passing.

**And production is not pinned either — this section said otherwise and was wrong.** It claimed *"what
holds production to its own behaviour is the mounted `DetailPane.test.ts` suite"*, and 2d-5-1-A's own
review measured that claim false: `rg 'invalidate|creating' src/lib/components/DetailPane.test.ts`
matches **nothing**, and that suite's cases stop at opening the restore pane, so
`invalidateEverySurface` is reached by no test and deleting `creating = false` from it would break
none. **The rule is unpinned on both sides.** What this phase bought is one honest model of a rule, not
half of an agreement between a model and a test, and the difference matters because the first version
of this sentence would have let a reader believe the production side was already covered. The
correction is in the helper's own doc comment as well as here, since a helper claiming to model
production is exactly the kind of claim that needs its limit beside it.

It also models the **rule** and never the surrounding facts. In today's window, `busy` makes a
creator and a restore mutually exclusive, so the two arms this helper is most careful about cannot
both arise there yet; the recorder will happily hold a list the window could not currently produce,
which is what makes it useful to 2d-5-2 and what stops it being evidence about a screen.

---

## 3. Finding 2 — `targetingSurfaceFor` prefers a surface that names the file

### 3.1 What it was, and why it was worth fixing with no consumer

The predicate returned the **first** surface in array order that either named the document or was an
eligible destination-less creator. So an unknown creator listed earlier shadowed an exact document
match listed later, and the returned **kind** named the creator when a specific surface was the
better answer. The review graded it Low correctly: the yes/no answer is unaffected. The kind is what
a 2d-5-4 sentence would put on screen, there is **no consumer at all** yet, and a predicate with no
consumer is the cheapest thing in this repository to change.

### 3.2 What shipped

One local, `unnamedCreator`, holding the first destination-less creator the list yields under a
`creatorEligible` eligibility. An exact document match still returns immediately from inside the
loop; the creator is returned only after the whole list has failed to produce one. The `switch` on
`target.kind` and its `never` terminus are untouched, so a third arm of `WriteSurfaceTarget` is still
a compile error here — and `EVERY_TARGET` in `restore.test.ts` still makes it one in the test file.

`competingSurfaceFor` was **not touched**. It answers `null` for an unknown creator, that is 2c-5's
shipped and window-read behaviour, and this phase was told not to move it.

### 3.3 What the new ordering does **not** guarantee

Written here and in the function's own doc comment, because an ordering rule reads like a
canonicalization and is not one:

- **It is still one answer out of possibly several exact matches, and array order still decides among
  those.** Two match editors over one file answer whichever the caller listed first. The preference
  is only between *specificity classes* — names-this-file versus names-nothing — never within one.
- **It ranks no named kind above another.** A raw editor and a match deleter over the same file are
  separated by array order alone; nothing here says a raw editor is the more important answer.
- **It changes no yes/no answer whatsoever.** An exact match and an eligible unknown creator each
  make the answer non-null on their own, so the set of `(document, surfaces, eligibility)` triples
  answered `null` is exactly what it was under first-match. The fix is about *which kind* is named
  and about nothing else, which is why it could be taken with no consumer and no behaviour bound to
  it.
- **It says nothing about which destination an unknown creator would actually choose.** That was
  never knowable here and still is not; `creatorEligibilityOf`'s own bounds (`2d-5-1-notes.md` §3)
  are unchanged.
- **It says nothing about whether any surface has been edited** (R36), which the doc comment already
  said and this fix does not touch.

### 3.4 The pin

The pre-existing case *answers the first surface of the list …* asserted the shadowing shape and had
to change — it is the case the old behaviour was pinned by. It is replaced by two:

- *prefers a surface that names the file to an earlier creator that names none* — asserts
  `[UNKNOWN_CREATOR, rawEditor@TARGET]` and `[rawEditor@TARGET, UNKNOWN_CREATOR]` **both** answer
  `rawEditor`, plus the empty list. Measured: reverting the source to first-match makes this case
  fail (`1 failed | 220 passed`), expecting `rawEditor` and receiving `matchCreator`. It is a pin,
  not a description.
- *keeps array order among exact matches, and answers the same yes or no as before* — drives the two
  things §3.3 says the ordering does not give: two exact matches answered in array order both ways
  round, and an unknown creator still answering on its own when nothing names the file and still
  answering nothing for a file that is not creator-eligible.

---

## 4. The four gates, measured

Every figure below was measured on this tree, each command unpiped except where a line is explicitly
an arithmetic sum of an unpiped run's own output. The baseline this phase started from is
**`1320 / 436 / 2202 / 185`**.

| Gate | Before | After | Why it moved, or did not |
|---|---|---|---|
| `cargo test --workspace` | 1320 | **1320** | no Rust changed — nothing under `crates/` or `src-tauri/` is in the diff |
| `npm run check` files | 436 | **436** | no file added; **0 errors, 0 warnings** |
| `npm test` | 2202 | **2205** | +3 cases, all three in `restore.test.ts` |
| `npm run build` modules | 185 | **185** | no new module, no new component, so neither ladder rung applies |

**The per-file derivation, re-derived on a pristine `git archive HEAD` tree rather than inferred from
the total.** This is 2d-5-1's own recorded mistake (`2d-5-1-notes.md` §5: a total that sums correctly
is not a breakdown), and the specific hazard is that `scripts/lint/ipc-detail.test.ts` generates its
cases from `scannableFiles()`, so it moves when a *file* is added and no author touches it:

| File | Pristine `HEAD` | This tree |
|---|---|---|
| `src/lib/browser/restore.test.ts` | 218 | **221** |
| `scripts/lint/ipc-detail.test.ts` | 130 | **130** |

Both figures come from running those files on a `git archive HEAD` extraction with `node_modules`
symlinked in: the two together report **348** there, `ipc-detail.test.ts` alone reports **130** there
and **130** here, so `restore.test.ts` is 218 → 221. 2202 + 3 = 2205, and the +3 is fully accounted
for by one file. No file was added, which is why the generated suite did not move.

`npm run check` reports `436 FILES 0 ERRORS 0 WARNINGS 0 FILES_WITH_PROBLEMS`. `npm test` reports
**58 files, 2205 passed**. The Rust figure is the sum of **26** binaries' `test result: ok` lines,
all `0 failed`, with `cargo test --workspace` exiting 0 — and it was run with no other copy of itself
running (`pgrep` for `cargo` and `target/debug/deps` found nothing first), which is the false-red
hazard `2d-5-1-notes.md` §5 and `PROGRESS.md` both record.

**Both bundle oracles were read, and both lines are reported**, because the second exists to prove
the search can match at all (`CLAUDE.md` §4):

```
rg -c '\$\$payload|head_payload|push_element' dist/assets/index-*.js   → no match (server-only, ABSENT)
rg -c 'window\.__svelte|svelte-trusted-html'  dist/assets/index-*.js   → 2      (client-only, PRESENT)
```

`cargo clippy --workspace --all-targets -- -D warnings` and `cargo fmt --check` both exit 0, as does
the architecture-rule check (`cargo tree -p espansoconfig-core | rg tauri` finds nothing).

**185 is not a number to wave through**, even unchanged: `CLAUDE.md` §4 records that 185's
neighbourhood is exactly where the old "the Svelte server build leaked in" shorthand stopped
discriminating. The arithmetic reason it did not move is that this phase added no `.ts` module and no
`.svelte` file, and the bundle search above is the other half rather than a substitute for it.

---

## 5. Where it is thin

Marked per `CLAUDE.md` §7.3. **No item here commissions a review round** — §7.1 is the only mechanism
and it reads a diff. **No item names a correctness defect in a source file**, so none is a blocker.

1. **The recorder models production, nothing relates the two, and production is not tested either —
   *recorded only* for the first half, *actionable* for the second.** §2.5 is the statement, as
   corrected. `closedByReplacementOf` is a hand-written copy of `invalidateEverySurface`'s rule, and a
   change to that function leaves this silently stale with every case still green; the only thing that
   could close *that* is a shared value both sides consume, which would be a coordinator — 2d-5-2's
   and 2d-5-3's work, and inventing one here is what this phase was told not to do.

   **The actionable half is narrower and is a check that can be run in files that exist**:
   `invalidateEverySurface` (`src/lib/components/DetailPane.svelte:545-563`) is reached by **no test**
   — `rg 'invalidate|creating' src/lib/components/DetailPane.test.ts` matches nothing — so deleting
   `creating = false` from it breaks nothing in the suite. **It is not a blocker**: the function is
   correct as written and the orchestrator read it against the model, so what is named here is a
   coverage gap and never a correctness defect in source, and `CLAUDE.md` §7.3 makes only the latter
   hold a step open. **2d-5-2 is where it belongs**, because that step already owns `DetailPane` and
   already owes it mounted evidence.

2. **`targetingSurfaceFor`'s preference has no consumer, so its fitness is untested — *recorded
   only*.** Every claim about the *kind* mattering rests on reading what a 2d-5-4 sentence would do
   with it. If 2d-5-4 finds the preference wrong — for instance that it wants the creator named even
   when a specific surface exists, to say *a form may be about this file* — this phase's tests will
   all still pass while pinning the wrong preference. It is a cheap thing to move while nothing
   consumes it, which is the argument for taking it now and is also the reason it cannot be validated
   now.

3. **The two new coordinator cases drive a surface list the window cannot currently hold — *recorded
   only*.** `busy` makes the creator and the restore mutually exclusive in `DetailPane.svelte` today,
   so the lists these cases construct are legal values of the type and not states of the shipped
   window. That is deliberate — 2d-5-2 is when they become reachable — but it means the cases are
   evidence about the model and never about a screen, and no window reading was taken or is owed
   here: this phase changed no component, no markup, no prop and no reactive statement.

4. **The restore exemption (rule 2 of §2.3) was fixed without a finding asking for it — *recorded
   only*.** It is the same class as the finding and it is now pinned by its own case, but it widens
   this phase's diff by one arm beyond what the review named. Recorded so the review of this phase
   reads it as a deliberate inclusion rather than as scope drift it has to rediscover.

5. **`competingSurfaceFor` was deliberately not touched, and the two predicates now differ in one
   more way — *recorded only*.** The competition predicate still answers the first competing surface
   in array order; only the targeting predicate prefers an exact match. That asymmetry is
   defensible — the competition predicate's answer feeds a refusal sentence about a surface that is
   in the way, and any of them will do — but it is now an asymmetry a reader has to be told about
   rather than one both functions display. Changing it was out of scope by instruction, and it is
   also not obviously right to change.

6. **Neither fix was reviewed when it was written — *recorded only*, and it is this phase's whole
   point.** The review that discharges §7.1 for both changes is this phase's own, and until it has
   run, everything above is a claim by the author of the change.

---

## 6. The review, and what it left to Phase 2d-5-1-B

The phase's one adversarial review is [`docs/reviews/phase-2d-5-1-A.md`](../reviews/phase-2d-5-1-A.md).
**Verdict: `ship-with-fixes`, no blockers.** Three should-fix findings, **all three false claims in a
comment**, which is this project's named worst defect class — and all three were fixed, in this record
and in the two source files:

| Finding | Where | Fixed |
|---|---|---|
| *"the mounted `DetailPane.test.ts` suite is what holds production to its own behaviour"* — no test reaches `invalidateEverySurface` at all | `restore.test.ts` helper comment, and §2.5 here | ✅ both |
| *"otherwise the first destination-less creator the list holds"* — drops the `creatorEligible` gate, so it describes an answer the function does not give | `restore.ts` `targetingSurfaceFor` doc | ✅ |
| *"the six named kinds"* — `OpenWriteSurfaceKind` has **seven**; six is `CompetingWriteSurfaceKind`'s count, and it excludes the `restore` kind this predicate deliberately counts | `restore.ts` `targetingSurfaceFor` doc | ✅ |

**All three were re-derived before being accepted**, not taken on the reviewer's word: the `rg` over
`DetailPane.test.ts` was run and matches nothing, and `OpenWriteSurfaceKind`'s seven members were
counted at `restore.ts:340-354` against `CompetingWriteSurfaceKind`'s exclusion at `:356-363`.

**That fix round changed two source files, so `CLAUDE.md` §7.1 commissions a round, and this phase has
no review invocation left to run it.** §7.4 says what follows: the round is carried by a new corrective
phase — **2d-5-1-B** — scoped to exactly these three comment corrections and to nothing else. It is
recorded in `PROGRESS.md` as the next action.

**Two things worth saying plainly about that.** The corrections are comment-only and the gates are
unmoved (`1320 / 436 / 2205 / 185`, with the Rust half proven unchanged by an empty
`git diff --stat HEAD -- crates/ src-tauri/`), so the risk 2d-5-1-B carries is small — but *"the unit is
the file, not the line"* is §7's rule precisely so that nobody has to argue about which comment was
load-bearing, and several of this project's contracts live in comments. And if 2d-5-1-B's own fix round
changes no source file, **§7.1 commissions nothing and the tail ends there, by rule** — which is the
shape `CLAUDE.md` §7.2 describes and which this project has now closed three tails with.
