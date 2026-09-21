# Phase 2d-5-5b — same-revision coalescing, different-revision supersession, and the per-document in-flight-write barrier

**Status: implemented, reviewed, four findings fixed, gates green.** Risk class: **high** — it adds
a refusal to `adoptDiskVersion`, the one door that installs a projection from a conflict, and it
opens a barrier inside all six writing wrappers. Components: **none**. No `.svelte` file is touched.

**§8 is the adversarial review and what each of its four findings was worth.** All four held and all
four are fixed; §2, §6 and §7 were corrected in place where the review showed them wrong, so this
record is read as it now stands and not as a history.

This is the second half of step 5 of the design consult
([`docs/reviews/phase-2d-5-design.md`](../reviews/phase-2d-5-design.md)), whose **Q7** is the
specification. Binding rulings **25, 26 and 27** of
[`2d-5-split-notes.md`](2d-5-split-notes.md) §3 are this phase's; rulings 21 to 24 were
[2d-5-5a](2d-5-5a-notes.md)'s and nothing below re-opens them.

---

## 1. What was already there, and what this phase added

2d-5-5a shipped the origin union, the two memos, the six re-keyed registrations, the external
registration door and `reapplyEvidenceFor`'s origin switch. **Nothing arbitrated between the two
origins, and nothing knew a write was in flight.** This phase added exactly that, in four places:

1. **The decisions, as pure values in `src/lib/browser/conflictSource.ts`** — `standingConflictOf`,
   `arbitrateObservation`, `releaseBarrier` and `newestObservationOf`. They read no state, register
   nothing and reach no command.
2. **The tables those decisions are made against, on `BrowserState`** — a standing conflict per
   file, an in-flight count per file, at most one retained observation per file, and the set of
   files whose last settled write may have written.
3. **The one door that applies all three rulings together** —
   `BrowserState.observeExternalChange`.
4. **The two halves of ruling 26 that are not a model** — `adoptDiskVersion` refuses an origin that
   no longer stands, and `reapplyEvidenceFor` refuses evidence taken from one.

---

## 2. The rulings, and how each is discharged

### Ruling 25 — at the same document and the same `disk_revision`, the save conflict wins

`arbitrateObservation` (`src/lib/browser/conflictSource.ts:510`) answers `coalesced` when the
arriving observation's revision equals the standing conflict's, and the `coalesced` arm carries the
**standing** origin and nothing else. That is the ruling read literally: the watcher observation
must not replace the model, its messages **or its source identity**, and the way to keep the third
is to register nothing — `arbitrateHere` (`workspace.svelte.ts:2963`) calls the registration door
only on the three arms that name a new origin.

**Both orders are implemented and both are pinned.** Save-then-watcher is the coalescing above
(`workspace.test.ts:6705`). Watcher-then-save is the other half and is not the same code: the
refusal registers through `rememberTheConflict`, which is **last-registration-wins for the standing
map** while remaining first-registration-wins for the origin map, so the refusal becomes the
standing conflict and the watcher conflict's pending confirmation is withdrawn
(`workspace.test.ts:6727`).

**What the ruling does not license, written where the decision is made.** Revision equality proves
identical bytes and never origin or chronology. The arbitration says so in its own doc, and the
sequence/watermark half of the ruling is **not** this door's: `AcceptedSequences.admit` and the
reconciliation cursor are untouched by this phase, so a `coalesced` answer says nothing about
whether the batch was acknowledged. `observeExternalChange`'s doc states that in as many words.

### Ruling 26 — a strictly higher sequence with a different revision supersedes the disk side

Five things the ruling asks for, and where each is:

| Asked | Where |
|---|---|
| Draft preserved | `supersedeConflict` (`saveOutcome.ts:1178`) reads it off the superseded model; it is never a second argument |
| Disk text, projection, revision, findings, origin replaced | all five are the observation's, carried inside the memoized source that `describeExternalConflict` builds |
| The save conflict's `found` never rendered as the current disk revision | the replacement is an `ExternalConflictModel`, which has no `found` — by type, not by care |
| Any pending reload confirmation withdrawn | `adoptDiskVersion`'s new step 4 (`workspace.svelte.ts:4029`) |
| Old reapply evidence invalidated | `reapplyEvidenceFor`'s new `superseded` arm (`reapply.ts:500`) |

**The `adoptDiskVersion` check is the one this phase could not do without, and the reason is that a
supersession installs nothing.** The existing generation comparison refuses a conflict whose file's
projection has been replaced since it arrived; a supersession replaces no projection, so no
generation moves and that comparison is blind to it. Without the standing test, a superseded
conflict would still install its older disk snapshot and answer `installed` for moving the window
backwards — the same failure the generation comparison exists for, in the one shape it cannot see.
It is placed **before** the `alreadyThere` arm deliberately: a window that happens to hold those
bytes would otherwise be told *you are already there* about a file a later reading says has changed
again, which is a true sentence leaving a false impression.

**Hashes carry no order, so only the sequence defines "later"**, and the arbitration compares
sequences before anything else. Against a **save** conflict there is no sequence at all:
`standingConflictOf` answers `null` rather than zero for that arm, and the revision is then the
whole of what decides. `conflictSource.test.ts:310` pins that, and the function's own doc states
what that rests on and what it does not — see §6 item 1.

### Ruling 27 — an in-flight write is a per-document arbitration barrier

`beginWrite` (`workspace.svelte.ts:3074`) opens the barrier and hands back a one-shot lease; all six
writing wrappers open it immediately before their command, record what the answer established the
moment it arrives, and close it in a `finally` — so it closes on **every** exit, an exception
included, and always after their own adoption or invalidation has run. *(The lease was
`settle`-on-both-exit-paths as implemented; the `finally` is §8's finding 3.)* While it is open,
`observeExternalChange` retains the observation — coalescing with whatever was already held by
keeping the newest — and answers `retained`, registering nothing.

The four bullets of Q7, each as code:

- **The save commits** → the wrapper's existing projection invalidation runs first, because the
  close is in the `finally`; `releaseBarrier` then answers `writtenHere` for a held observation whose
  revision is the one the transaction ended on, and it is dropped. `workspace.test.ts:6876`. **The
  observation is registered at the generation it arrived at and not at the one it is released at**,
  which is §8's finding 1 (`workspace.test.ts:7023`).
- **It returns a save conflict** → the refusal registered before the close, so it is standing, and
  the released observation is arbitrated against it: equal revision coalesces, a different one
  supersedes.
- **It fails without possible writing** → the held observation is arbitrated normally.
  `workspace.test.ts:6918`.
- **It may have written** → the uncertainty is recorded and *preserved*, and every verdict for that
  file afterwards is `raisedWithoutReload`: the observation still becomes the file's conflict, so
  the person is told, and no automatic reload may be made from it. `workspace.test.ts:6942`.

**No save command may ever be initiated by watcher arbitration.** The narrowest way to say so was to
make it unreachable: neither `arbitrateObservation` nor `releaseBarrier` can name a command, and
`observeExternalChange` calls none. `workspace.test.ts:6994` is the assertion — five editing spies
never called, the raw save called exactly once by the case itself, no reload, and both read counts
unmoved across three arbitrations.

---

## 3. The one new user-facing code

`browser.reapply.supersededConflict` in `src/lib/i18n/en.json` and `src/lib/i18n/es.json`, reached
through `SUPERSEDED_EVIDENCE_KEY` (`reapply.ts:417`) and the accessors
`describeSupersededEvidence` / `tSupersededEvidence` in `src/lib/i18n/index.ts`. It carries no
operand and names no revision, for the reason 2d-5-5a's three refusals do not: a content revision is
a hex digest, and showing one beside a refusal invites a person to compare two strings that carry no
order.

**A constant rather than a key function**, because the arm it belongs to has no operand to switch
on; the `TranslationKey` annotation is what makes a renamed key a compile error, which is the whole
job the sibling key functions do with a `switch`. The accessor lives in `index.ts` beside every
other browser-model accessor, which is the same deviation from the brief's wording 2d-5-5a §3
recorded and for the same reason: `codes.ts` is for wire enums.

**Nothing draws it**, and its doc says so. `reapply.test.ts:490` pins that the key is a real entry
in both dictionaries and is not one of the three external-evidence refusals — never that the
sentence is true.

---

## 4. Two decisions taken for shape rather than for behaviour

**`ArbitrationOutcome` is `Exclude<ObservationVerdict, { kind: 'retained' }>`**
(`conflictSource.ts:461`). The pure arbitration holds no barrier and therefore cannot answer that a
write is in flight; making that a type rather than a sentence is what stops a later author adding a
`retained` return to a function with nothing to return it from.

**The barrier's state lives on `BrowserState`, not in `conflictSource.ts`.** A factory there would
have had to be handed the registration door to do anything with what it released, which would make
the vocabulary module able to register conflicts. Keeping the decisions pure and the tables in the
state module means `conflictSource.ts` still installs nothing, registers nothing and holds no state
— its header says exactly that, corrected in place.

---

## 5. Records corrected rather than appended to

Four passages claimed a state the tree no longer holds, and each was **edited where it stood**:

- `conflictSource.ts`'s header said the module arbitrates nothing and that
  `externalConflictSource` has no production caller. It now says what it does arbitrate, that it
  still installs and registers nothing, and that what has no caller is a **component**.
- `adoptDiskVersion`'s ordered list of checks was six long and is now seven; the sentence *"the
  first four precede every successful answer"* is now *"the first five"*, and the `alreadyThere`
  paragraph, which named step 5, names step 6 and says it is answered after the standing test.
- `ReapplyEvidenceAccess`'s header said *three arms for two origins*; it is four, and the fourth is
  true of both origins.
- `ExternalEvidenceRefusal`'s *"three refusals and no fourth"* stands — the supersession is not one
  of its members, which is §2's point — and was deliberately left alone.

---

## 6. Where it is thin

**This list does not say that nothing below is a defect.** Its previous opening sentence — *no item
below names an unfixed correctness defect in a source file, so none holds this step open* — was one
of the things the adversarial review tested, and the review was right and this record was wrong:
item 3 described a write lease that leaks on a throw as a trade taken deliberately, and §8's finding
3 is that leak, reproduced and now fixed. What is true of the list as it stands is narrower, and is
all a record can honestly claim: **each item is a limitation this phase took knowingly, and none of
them is a case any test in this repository fails.** Whether one of them is *also* a defect is a
judgement a reader makes against the code, which is exactly what happened to item 3. Items 3 and 8
were rewritten after the review; items 13 and 14 are new and name what the fix itself cost.

1. **Nothing in this layer can order a watcher read against a locked read.** The barrier keeps an
   observation delivered *during* this window's own write out of the arbitration until the write
   settles, and that is the whole of the ordering it buys. An observation that the watcher took
   **before** a save was refused and that drained **after** it is not bounded by anything here: it
   carries a different revision, so it supersedes a fresher save conflict. That is what the consult
   ruled for the case, the arbitration's own doc says it in the same sentence as what it does
   establish, and no test in this repository can distinguish the two orderings because nothing in
   the values carries a clock.

2. **`observeExternalChange` has no production caller.** The coordinator's path to a surface is
   `tellTheSurfaceAbout` in `observationTransitions.ts`, which fires the registered
   `WriteSurfaceTransition` — a no-op in every component today. Wiring the arbitration in front of
   it means adding a member to `ReconciliationWorkspace`, which every fake in
   `observationTransitions.test.ts` implements, and deciding what a `retained` verdict does to a
   surface — a component question, and 2d-6's. **So the barrier really runs in production and the
   arbitration it protects does not**: `beginWrite` and `settle` are reached by all six wrappers on
   every save this application makes, and nothing production-side ever asks the door a question.
   No gate in this repository would notice if `observeExternalChange` stopped working.

3. **The lease is closed in a `finally` and a throw no longer strands the barrier — and what the
   close settles on can be a guess.** *(Rewritten after the review; see §8 finding 3 for the text
   this replaces and why it was wrong.)* Each of the six wrappers now wraps its body in
   `try { … } finally { write.close(); }`, and the lease has two methods: `expect` records what the
   answer established, `close` releases on that or — when nothing was established — on `uncertain`.
   So an exception after the command answered settles on what the answer really said, and an
   exception before it settles on the one honest thing left, which is *this application cannot say*.
   **What that costs is item 13.** Nothing in TypeScript forces a lease to be closed at all; the
   `finally` at each of the six call sites is the whole of what does.

4. **The uncertainty of a `mayHaveWritten` write is cleared by exactly two things**: a later write
   of this window's own that *ended* on a named revision, and `open()`. No observation clears it,
   which is the ruling; but no person can clear it either, because no surface can reach it, so a
   file that met one uncertain write keeps `writeOutcomeUncertain` for the rest of the session
   unless it is written again. That is recorded rather than fixed: what should end an uncertainty a
   person has looked at is a decision about a panel, and there is no panel.

5. **`standingConflicts` is a second table about conflicts, and only one function keeps it in step
   with the first.** `conflictOrigins` answers *did this state register this origin, and against
   which projection*; `standingConflicts` answers *which registered origin is current for this
   file*. Both are written inside `rememberTheConflict` and neither is written anywhere else, so
   they cannot be updated apart today — and **nothing in TypeScript says so**. A future registration
   path that wrote one map directly would make the two disagree, and the symptom would be a refused
   adoption rather than a wrong one.

6. **A second save conflict for one file now refuses the first one's adoption.** That is a
   behaviour change beyond the watcher case and it is deliberate: the newer refusal read the file
   later, so the older one's disk snapshot is a reading the file has moved on from. No inherited
   case covered it: every one of the 2433 still passes, and the only ones this phase edited are the
   six `reapplyEvidenceFor` call sites, which changed because the function took a second operand and
   not because an expectation moved. It is therefore pinned only by the new watcher-then-save case,
   which reaches the same refusal by the same path.

7. **`supersedeConflict` has no production caller either**, for item 2's reason: it is the model a
   panel would draw after a supersession, and no panel draws one. Its callers are
   `saveOutcome.test.ts` and `workspace.test.ts`.

8. **`reapplyEvidenceFor`'s new operand is a guard, not a lookup.** *(Rewritten after the review;
   §8 finding 4.)* It is now a `StandingOriginGuard` — `() => ConflictSource | null` — asked **once,
   after every operand has been read**, because a value operand is answered before the evidence
   reads and those reads run caller-controlled code. What the change does not buy is who answers it:
   `() => state.standingConflictFor(document)` is the honest closure, `() => conflict.source`
   defeats the check without writing anything a type could refuse, `() => null` is the conservative
   direction, and nothing in TypeScript tells the three apart.

9. **Open item 3 of `PROGRESS.md` was not taken.** `saveReapplyEvidence` still hands the wire
   payload back by identity while the external arm is snapshot-bound. This phase touched
   `reapply.ts`, so it *could* have; it did not, because the change belongs with a decision about
   whether one rule governs both origins' evidence, and this phase's scope was ruling 26's
   invalidation rather than the evidence's provenance. It stays where `PROGRESS.md` has it.

10. **The five should-fix items of `docs/reviews/phase-2d-5-4-H.md` were not taken.** Two of them
    are in `observationTransitions.ts` and `reconciliationCoordinator.ts`, which this phase did not
    change: the arbitration deliberately lives beside the conflict vocabulary and the state, not in
    the drain path. `PROGRESS.md` open item 0 keeps them.

11. **The live reapply path does not go through `reapplyEvidenceFor`, so ruling 26's evidence
    refusal does not gate it.** `beginReapply` reads `saveReapplyEvidence` directly, which is the
    shape 2c-4b-2 shipped and the five match surfaces use; `reapplyEvidenceFor` is the origin
    switch 2d-5-5a added above them and its callers are still tests alone. What stops a superseded
    conflict's reapply from landing is therefore not the evidence gate but the **adoption**:
    `reapplyToDiskVersion` installs through `adoptDiskVersion`, which now refuses a superseded
    origin, so the surface answers `adoptionRefused` and nothing is installed. That is a real
    safety story and it is a narrower one than *the evidence is refused* — the target is still
    computed from stale rows, and only the install is stopped. Unifying the two is the phase that
    takes `PROGRESS.md` open item 3.

12. **No case in this repository drives two overlapping writes of one file.** The barrier counts
    rather than flags for that case, and `busy` keeps the seven surfaces mutually exclusive today,
    so the count's second increment is unreachable from any component. The comment on
    `writesInFlight` says the exclusivity is a fact about the components and not about the type; the
    counting itself is therefore unevidenced.

13. **An exception-safe close charges an uncertainty that only a later write can clear.** A command
    that rejects settles `uncertain`, which is what *cannot be attributed* is called, and item 4
    above says what that means in practice: nothing a watcher reports clears it and no surface can,
    so a file whose write rejected keeps `writeOutcomeUncertain` — every later verdict for it is
    `raisedWithoutReload` — until a write of this window's own ends on a named revision or `open()`
    replaces the workspace. The alternative was the leak the review found, and that is the whole
    argument: a permanently barriered file is reconciled never, where an uncertain one is reconciled
    conservatively. **A panel that lets a person end an uncertainty they have looked at is still
    2d-6's**, and item 4 is where it is written down.

14. **A verdict decided against a state that moved underneath it retains its observation, and
    nothing guarantees anybody looks at it again.** That is `arbitrateHere`'s revalidation (§8
    finding 2): the observation is held rather than registered, which is the safe direction, and the
    thing that releases a held observation is the settlement of a write for that file. If none is
    ever made, it stays held until `open()`. It is reachable only through a caller-controlled getter
    that re-enters this state, which no production caller does today — `observeExternalChange` still
    has none at all (item 2) — so the arm is pinned by its case and by nothing else.

---

## 7. Verification

Every command run on its own, on the final tree, with nothing run concurrently with `cargo`. **The
three frontend rows were re-run after the review fix of §8 and are that run's figures**; the three
Rust rows are the implementation run's, because the fix changed no Rust and `git diff --numstat --
crates/ src-tauri/` names exactly one path, the instrument's `src-tauri/src/main.rs`, at `2 1`.

| Gate | Command | Result |
|---|---|---|
| Rust tests | `cargo test --workspace -- --test-threads=1` | exit 0 — **1320** over **26** `test result` lines |
| Clippy | `cargo clippy --workspace --all-targets -- -D warnings` | exit 0 |
| Format | `cargo fmt --check` | exit 0 |
| Architecture | `cargo tree -p espansoconfig-core \| rg tauri` | finds nothing (exit 1, no output) |
| svelte-check | `npm run check` | exit 0 — **443 files, 0 errors, 0 warnings** |
| vitest | `npm test` | exit 0 — **2466 passed in 61 files** |
| Vite | `npm run build` | exit 0 — **189 modules** |

**Both complementary questions were asked of the Rust gate**: the sum over the 26 `test result`
lines is 1320, **no line lacks `0 failed`**, and **no line lacks `0 filtered out`**.

**No Rust source changed.** `git status --short --untracked-files=all` names one tracked path under
`src-tauri/`, the instrument's `src-tauri/src/main.rs`, which this phase never edited; the three
Rust rows were run anyway because they are cheap and because a phase that claims them must have run
them.

**Both bundle oracles were read and both lines are reported.** Server-only markers
(`$$payload|head_payload|push_element`) — **absent**, `rg -c` produced no output. Client-only markers
(`window.__svelte|svelte-trusted-html`) — **present, 2**.

**The instrument pin holds**: `git diff --stat src-tauri/src/main.rs src/main.ts` is
`5 insertions(+), 1 deletion(-)`. Neither instrument path was edited, staged or reverted, and
`src-tauri/src/probe.rs` and `src/probe.ts` remain untracked.

### The four figures, and why two did not move

The rung was `1320 / 443 / 2433 / 189` at 2d-5-5a and is **`1320 / 443 / 2466 / 189`**.

| Gate | Was | Now | Why |
|---|---|---|---|
| `cargo test` | 1320 | **1320** | no Rust source changed |
| `npm run check` files | 443 | **443** | **no file was added or removed** — every change is inside an existing module or an existing suite, which is why the arbitration lives in `conflictSource.ts` rather than in a module of its own |
| `npm test` | 2433 | **2466** | **+33, and each is a new case**: the implementation's 28 — 11 in `conflictSource.test.ts` (7 arbitration, 4 barrier), 3 in `saveOutcome.test.ts` (`supersedeConflict`), 3 in `reapply.test.ts` (the supersession refusal and its sentence) and 11 in `workspace.test.ts` (both orders, supersession, three adoption answers, stale evidence, the committed/definite-failure/uncertain barrier releases, coalescing, no-command, and `open()`) — plus the review fix's **5**: 4 in `workspace.test.ts` (the arrival generation, the re-entrant registration, the six rejections, the throw after the answer) and 1 in `reapply.test.ts` (superseded while the evidence was assembled) |
| `npm run build` modules | 189 | **189** | no new `.ts` module and no new styled component |

### What no gate could catch

No gate fails for a *sentence*. The new dictionary entry, the four corrected passages and every
"what this does not force" clause in this record are checked by nothing executable; the defence is
`CLAUDE.md` §5's — each is derived from the code here, so a reader checks the record against the
code.

Nor does any gate reach the arbitration's **production** path, because there is none: §6 item 2 is
the honest statement of it, and 2d-6 is where that changes.

**And no gate failed for any of §8's four findings before they were fixed** — the inherited 2461 all
passed against the defective code, which is what §8's *reproduced* column is for: each fix is pinned
by a case that fails against the shape that preceded it, and that failure is quoted verbatim.

---

## 8. The adversarial review, and what each of its four findings was worth

[`docs/reviews/phase-2d-5-5b.md`](../reviews/phase-2d-5-5b.md) — verdict **ship-with-fixes**, three
blockers and one SHOULD-FIX, **all four in source**. Every finding body in that file ends in an
ellipsis, so none of them is an argument: each was re-derived here against the code at the line it
names, and each verdict below is this phase's own, not the reviewer's repeated.

**All four hold.** Every one is fixed, in the file the review named, and every fix is pinned by a
case that fails against the shape that preceded it — the failure quoted verbatim, because a case
that passes both before and after a fix pins nothing.

**How a pre-fix run was obtained.** The fixes are in a working tree, not in a commit, so each was
reversed in place for one run and restored. For findings 1, 2 and 4 the reversal is one statement.
For finding 3 it is three, because the fix moved code as well as adding a `finally`: the `close`
was made to release nothing when nothing had been expected (the old shape had no cleanup on a
throw), and the two `expect` calls were moved back to where the old `settle` calls stood. Under that
reversal **the whole inherited suite passes and only the two new cases fail**, which is what says
the reversal really is the old behaviour and not a third thing.

### Finding 1 — retained observations acquire a falsely fresh generation · **holds**

`src/lib/browser/workspace.svelte.ts`, the `arbitrate` arm of the barrier release.

A registration writes down the projection generation the conflict **arrived** at, and
`adoptDiskVersion` refuses an install when that generation is not the current one — that is the
whole of what stops a conflict installing a disk snapshot older than what the window now holds.
A retained observation arrives while a write is in flight and is registered when that write settles,
and a committing write **replaces that file's projection in between**, because every wrapper closes
its lease after its own adoption, deliberately. So the release registered the observation at the
generation the *release* ran at: the comparison then found the two equal and installed a snapshot
the window had already moved past, reporting `installed` for moving backwards. The record's own §2
prescribes the ordering that makes this reachable, so it is not a hypothetical.

**Fix.** `retainedObservations` holds a `RetainedObservation` — the observation *and* the generation
it arrived at — `retainObservation` is its only writer, `rememberTheConflict` takes the generation as
a parameter (defaulting to now, which is honest for the six save registrations), and `arbitrateHere`
carries an `arrival` operand from the door that took the observation in.

**Pinned by** `workspace.test.ts:7023`, *registers a released reading at the window it arrived at,
not at the one it left*: a reading of `rev-c` is held across a save that commits `rev-d` and re-reads
at `rev-d`; the adoption of that reading must be refused. Against the pre-fix shape:

```
AssertionError: expected 'installed' to be 'refused' // Object.is equality
```

### Finding 2 — re-entrant arbitration overwrites a newer origin · **holds**

`src/lib/browser/workspace.svelte.ts`, `arbitrateHere`.

This project's named check-and-spend class, one level up from where 2d-5-5a met it. `arbitrateHere`
read the standing origin, then handed it to `standingConflictOf` and the observation to
`arbitrateObservation` — **both of which read properties of values a caller assembled** — and then
registered the verdict without looking at the tables again. A getter or a `Proxy` trap among those
reads can re-enter this state through any of its public methods: register a strictly later reading,
open a write barrier, replace the projection. Registering afterwards then writes the *older* origin
over the newer one, and because the standing map is deliberately last-registration-wins, nothing
refuses it. `readonly` freezes nothing at runtime and `Exclude<…, 'retained'>` is a type-level
narrowing that forces nothing at all.

**Fix.** The four facts the verdict was decided against — the standing origin, the uncertainty, the
projection generation and the in-flight count — are captured before the arbitration and compared
with the four that hold at the spend. A verdict decided against a state that is gone registers
nothing: the observation is retained and `retained` is answered, which is the conservative direction
and not a dropped reading. Its cost is §6 item 14, and the `retained` arm's own doc in
`conflictSource.ts` was widened in place to say a second thing answers it.

**Pinned by** `workspace.test.ts:7066`, *registers no verdict decided against a standing origin that
moved underneath it*: the arriving observation's `diskRevision` getter re-enters
`observeExternalChange` with a reading at sequence 12; the origin that stands afterwards must be
that one. Against the pre-fix shape:

```
AssertionError: expected 5 to be 12 // Object.is equality
```

### Finding 3 — write leases and outcomes are not exception-safe · **holds**

`src/lib/browser/workspace.svelte.ts`, all six writing wrappers.

Each wrapper took a lease immediately before its command and released it on its two *answer* paths,
so nothing released it when something in between threw: a command whose promise rejects, a reporter
that throws, a re-read that throws. The barrier is per document and there is no timeout and no other
door: every later observation of that file is retained and never arbitrated, for the life of the
session. §6 item 3 called this the safe direction and that is the half that is true — the other half
is that the file's reconciliation is silently dead, and `retainedObservationFor` is the only place it
shows. **It was also reproduced for every one of the six**, not argued for one and generalized.

**Fix.** The lease is now `expect` + `close`, and each wrapper is
`try { … } finally { write.close(); }`. `expect` records what the answer established the moment it
arrives — before the reporting and the adoption, which is what keeps a known outcome from being lost
to an exception in that stretch — and `close` releases once, on that settlement or, when nothing was
established, on `uncertain`. The ordering ruling 27 asks for is unchanged: a `finally` runs after the
body, so the release still follows the wrapper's own adoption.

**Pinned by two cases.** `workspace.test.ts:7128`, *closes the barrier when any of the six writing
wrappers rejects*, drives all six through a rejecting boundary; `workspace.test.ts:7153`, *closes the
barrier on what the answer established when the adoption throws*, commits a move and throws in the
re-read, with a reading of exactly the committed revision arriving during the write — so an
`uncertain` close would raise it as a conflict and the known settlement drops it as not-news. Both,
against the pre-fix shape:

```
AssertionError: expected true to be false // Object.is equality
```

### Finding 4 — the standing operand becomes stale during evidence reads · **holds**

`src/lib/browser/reapply.ts`, `reapplyEvidenceFor`.

The supersession check was first and its operand was a **value**, so even the honest caller —
`state.standingConflictFor(document)` — answered the question *before* the evidence was read. Every
read that builds the evidence crosses into a value a caller assembled: the table's two revisions, the
draft's base, the conflict's disk revision, and the iteration of the row array through
`Array.from`. Any of them can register a strictly later reading, and the function then hands back
`externalCorrespondence` for a conflict that no longer stands — precisely the evidence ruling 26
says must be invalidated.

**Fix.** The operand is a `StandingOriginGuard` (`() => ConflictSource | null`), the evidence is
assembled first by a new private `evidenceOf` — so every caller-controlled read, the array iteration
included, happens inside one call — and the guard is asked **once**, last, with nothing
caller-controlled between it and the return. What it does not buy is who answers it; §6 item 8 says
so. Its eight call sites, all of them in tests, pass a closure.

**Pinned by** `reapply.test.ts:452`, *refuses evidence the file moved past while that evidence was
being assembled*: the row array carries an iterator of its own that moves the standing origin, and
the case first asserts the same table is otherwise accepted, so the refusal is the supersession and
nothing else. Against the pre-fix ordering (the guard asked first):

```
AssertionError: expected 'externalCorrespondence' to be 'superseded' // Object.is equality
```

### The three NOT-VERIFIED items

- *Fix the three blockers and add regression tests covering the reproduced failures* — done above:
  five cases, each confirmed to fail against the shape that preceded it.
- *Correct the phase record's claim that its acknowledged limitations contain no unfixed source
  defects* — §6's opening sentence is rewritten to say what is true, and items 3 and 8 are rewritten
  where they stood rather than appended to (`CLAUDE.md` §7: records are records).
- *Run the affected frontend suites and checks after the fixes* — §7, re-run on this tree.

### What the fix deliberately did not touch

`CLAUDE.md` §7 binds a fix to the findings the review named and the files it named. Three things were
noticed on the way and are **not** fixed here: they are §6 items 13 and 14, which are the fix's own
costs, and the fact that `arbitrateHere`'s revalidation cannot re-arbitrate — it refuses to register
and holds the reading instead, where a bounded re-arbitration against the fresh state would be
strictly better and is a decision about how much re-entrancy this layer should absorb. Nothing else
in the six wrappers was changed: the reindentation is mechanical and the two `expect` positions are
the only statements that moved.
