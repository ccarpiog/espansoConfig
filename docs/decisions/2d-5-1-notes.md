# Phase 2d-5-1 — the surface and conflict vocabulary

**Status: complete.** Step 1 of the seven-step split
[`docs/decisions/2d-5-split-notes.md`](2d-5-split-notes.md) §2 records, and the first step of Phase
2d-5 that a compiler has seen. It is a types-and-model step: no coordinator, no registry, no drain
pump, no observation transitions, no watcher import, and nothing under `crates/` or `src-tauri/`
changed.

The consult that binds it is [`docs/reviews/phase-2d-5-design.md`](../reviews/phase-2d-5-design.md);
where this record and that document disagree, the consult wins.

---

## 1. What shipped

**Five things, and nothing else.**

1. **The widened single `OpenWriteSurface` union**, in `src/lib/browser/restore.ts` where it already
   lived. `WriteSurfaceDocumentTarget` and `WriteSurfaceTarget` are new named types; the union is the
   consult's declaration (`docs/reviews/phase-2d-5-design.md:51-63`) with those two names substituted
   for its inline shapes and nothing else altered — one arm for `matchCreator` whose `target` may be
   `unknown`, one arm for `Exclude<OpenWriteSurfaceKind, 'matchCreator'>` whose `target` is always a
   document.

2. **Two predicates over that one union, answering the `unknown` arm differently.**
   `competingSurfaceFor` — the restore predicate, unchanged in behaviour — now **switches on the
   target discriminant with a `never` terminus** instead of comparing `surface.document === document`.
   `targetingSurfaceFor` is new: the watcher-targeting predicate, which treats an unknown creator as
   targeting **every** creator-eligible match document, counts a `restore` surface (which
   `competingSurfaceFor` skips), and switches with its own `never` terminus.

3. **The definition of "creator-eligible match document"** — `creatorEligibilityOf` in the same
   file, plus the `CreatorEligibility` value it answers and `targetingSurfaceFor` takes. §3 below is
   the definition and its bounds.

4. **`ConflictSource`, the two memos and the origin lines** — a new module,
   `src/lib/browser/conflictSource.ts`. It holds `ExternalConflictObservation` (the flattened
   `Changed`/`Addressable`/`Projected` snapshot), the discriminated `ConflictSource`,
   `saveConflictSource` and `externalConflictSource` (one stable object per wire value, `WeakMap`-keyed
   on that value), and the origin-line vocabulary: `ConflictOriginMessage`, `conflictOriginMessage`
   and `conflictOriginMessageKey`.

5. **Two dictionary entries in each language and one accessor.**
   `browser.conflictOrigin.refusedSave` and `browser.conflictOrigin.changedWhileOpen` are in `en.json`
   and `es.json`; `tConflictOriginMessage` in `src/lib/i18n/index.ts` is the only way a component may
   reach either.

**What did not change, deliberately.** `conflictChoicesFor` in `src/lib/browser/saveOutcome.ts` is
still the only producer of a choice list — what this step adds are *lines*, never controls — and
`adoptDiskVersion` in `src/lib/browser/workspace.svelte.ts` is still the only confirmed-install door.
Neither function's source was touched. `ConflictModel.source` is still typed `ConflictResult`:
generalizing it, and the six `rememberTheConflict` registrations with it, is 2d-5-5's, and doing it
here would have been the coordinator work this step is defined to exclude.

**No production caller reads any of the new vocabulary yet**, and that is the step's shape rather
than an oversight: `targetingSurfaceFor`, `creatorEligibilityOf`, both memos and both origin lines
have tests and nothing else. 2d-5-4 and 2d-5-5 are where callers appear. `competingSurfaceFor` is the
exception and always was — it has production callers, and preserving their behaviour exactly is what
§4 entry 4 is about.

### 1.1 Files

| File | What changed |
|---|---|
| `src/lib/browser/restore.ts` | the union, both predicates, the eligibility definition, two imports |
| `src/lib/browser/conflictSource.ts` | **new** — the conflict-origin vocabulary |
| `src/lib/browser/conflictSource.test.ts` | **new** — 12 cases |
| `src/lib/browser/restore.test.ts` | **13** new cases (205 → 218), plus every construction site updated |
| `src/lib/components/DetailPane.svelte` | six literals in `openWriteSurfaces()`, mechanically |
| `src/lib/components/RestorePane.test.ts` | five construction sites, mechanically |
| `src/lib/i18n/en.json`, `src/lib/i18n/es.json` | two keys each |
| `src/lib/i18n/index.ts` | `tConflictOriginMessage` and its import |

---

## 2. The §6 item 1 decision: the mechanical edit was taken, not the additive widening

`2d-5-split-notes.md` §6 item 1 is the one thing this step had to decide before it started: the
consult declares 2d-5-1 *"components: none"* while changing the shape of a type whose only production
producer is `openWriteSurfaces()` in `src/lib/components/DetailPane.svelte`, so `npm run check` cannot
be green at the end of the step unless the widening is additive or the component is touched.

**The orchestrator ruled: take the mechanical edit.** The reason, recorded because it is a decision
and not a discovery: the consult's own declaration gives every non-creator kind
`target: { kind: 'document'; document: DocumentId }`, so an additive widening that left `document` at
the top level for six kinds would ship a shape the binding declaration does not have, and would leave
2d-5-4's watcher-targeting predicate reading **two** shapes where the ruling gives it one. The
additive route buys a green gate at the cost of a second migration nobody has budgeted and a union
that disagrees with the document that mandated it.

**So this step deviates from "components: none", and the deviation is six object literals and one
comment.** `openWriteSurfaces()` now pushes `{ kind: 'x', target: { kind: 'document', document: d } }`
where it pushed `{ kind: 'x', document: d }`. No executable line beyond those six changed: no new
markup, no new prop, no registry, no reporting of the creator's destination — all of that is 2d-5-2's.

**The comment is the seventh change and it was not optional.** That function's doc comment said the
new-snippet form is absent because *"a surface value for it would have to invent a document"*, and the
union this step ships is precisely what makes that false — the `unknown` target exists for that state.
Leaving it would have been a comment claiming an impossibility the code no longer has, which is this
project's worst defect class pointed the other way round. It is corrected to say what is now true: the
form is still absent because nothing reports its destination upward yet, which is 2d-5-2's, and an
unknown target would compete with no restore either way. **Nothing else in that comment was touched**,
and the correction changes no behaviour.

**The evidence position, and it is the orchestrator's call rather than a guarantee the code gives.**
No window reading was taken at this step, and the ground recorded here for that is **not** the one
this section first gave. The sentence it replaces claimed the rewritten producer is *"covered by the
existing mounted `DetailPane.test.ts` suite, which runs it through the paths that open and close each
surface"*, and that is **false** — 2d-5-1's review found it and it is corrected rather than softened,
because an untrue evidence claim inside the paragraph that justifies skipping a reading is this
project's worst defect class in its sharpest position.

**What is actually true, re-derived rather than accepted.** `openWriteSurfaces()` has exactly **one**
caller — `surfaces={openWriteSurfaces}` at `src/lib/components/DetailPane.svelte:966` — and that prop
sits inside the `{:else if restoring !== null}` arm at `:947` of the mutually exclusive chain that
begins `{#if editing !== null}` at `:844`. Reaching that arm means `editing`, `editingMatch`,
`deletingMatch`, `movingMatch` and `duplicatingMatch` are all `null` and `creating` is false, so of
the six rewritten literals **only the `restore` one can execute at all**, in production or in any
test. The other five are compiled, type-checked and unreachable.

**The conclusion the correction supports is the same conclusion, and it is stronger for it.** No
window reading is owed: this step added no markup, no prop, no reactive statement and no expression to
that component, the one literal that can execute is exercised by the mounted suite, and the other five
cannot reach a screen to be read. What the argument does **not** establish, in the same breath: it
says nothing about whether a window drew anything — a green mounted suite is not a screen
(`CLAUDE.md` §4) — and the unreachability it rests on is a fact about today's `{#if}` chain, which no
type enforces and which 2d-5-2 changes when it makes the registry exhaustive. The first reading of
this producer's new shape is 2d-5-2's, and it inherits the five literals this step could not exercise.

**The same edit was owed to the tests, and there were more of them than the record predicted.**
`2d-5-split-notes.md` §6 item 1 names `src/lib/components/RestorePane.test.ts:1079` as *the* test-side
constructor; the sweep found **four** in that file and **twelve** in `src/lib/browser/restore.test.ts`.
Nothing turned on the difference — the compiler finds every one of them — but a record that had been
trusted as a work list would have left eleven behind. The sweep was for the shape rather than for the
cited line: twelve in `restore.test.ts` (eight literal, four with a run-time `kind`) and four in
`RestorePane.test.ts` (three literal, one with a run-time `kind`), found by searching for the literal
shape and confirmed by the compiler, which is what makes "every one" a claim and not a hope.

**One further site needed more than a mechanical rewrite:** the
`coordinator()` recorder in `restore.test.ts` filtered its open list with `surface.document !==
invalidation.document`, which does not compile over the union; it now keeps a surface whose target is
`unknown`, which is right — a form that names no file is not over the replaced one.

---

## 3. What a "creator-eligible match document" is

`2d-5-split-notes.md` §6 item 3 leaves the definition to this step and its use to 2d-5-4. It is
stated in the doc comment of `creatorEligibilityOf` in `src/lib/browser/restore.ts` and here, in the
same words.

> **A creator-eligible match document is exactly a file the new-snippet form would offer as a
> *choosable* destination** — `destinationEligibility` in `src/lib/browser/matchCreation.ts` answering
> `eligible`, which today means a file espanso loads snippets from, that this application may write,
> that this window has read, whose text parsed, and that has a top-level snippet list.

**It is delegated rather than restated, and that is the whole design.** Writing those five conditions
out again would create a second rule that can drift from the form's own; asking the form's own
function means the two cannot disagree. The cost is one new import — `restore.ts` now imports
`matchCreation.ts` — and it is a new edge in the module graph, not a cycle: nothing in
`matchCreation.ts` reaches `restore.ts`, and `restore.ts` was already the leaf that `workspace.svelte.ts`
and `i18n/index.ts` import.

**What the definition does not guarantee, in the same breath as what it does.** It is a fact about
*this window's current projection* of the file and never about the file on disk, so a document can
stop being eligible — or become eligible — between an observation being admitted and this answer being
asked for. It says nothing about whether a new-snippet form is open at all, and nothing about which
destination such a form would actually choose: it names the **set** an unknown target may be about,
never a claim that it is about any particular member of that set. And nothing in TypeScript forces a
caller of `targetingSurfaceFor` to compute its `CreatorEligibility` argument with this function rather
than pass a literal — a wrong `'notCreatorEligible'` fails in the unsafe direction, because an
unknown creator that really could be about the file would then be missed.

---

## 4. The binding rulings this step discharged, and what each does not guarantee

`2d-5-split-notes.md` §3 numbers 35 rulings. Entries 3, 4 and 5 are this step's outright; entries 21,
22 and 23 are discharged as far as a vocabulary step can and are named with the part that is not.

**Entry 3 — one discriminated union, not two registries.** Discharged. `OpenWriteSurface` is one
union; the creator carries `{ kind: 'unknown' } | { kind: 'document'; document }` and every other kind
carries the document arm. It forces narrowing before a file can be read off a surface, and inventing a
document for a destination-less form is not representable. **It does not force a consumer to treat the
`unknown` arm conservatively after narrowing** — the two predicates deliberately answer it in opposite
directions, and only their own tests hold either to its answer. It also does not force a future author
to classify a new component as a write surface at all; that is 2d-5-2's exhaustive assembly.

**Entry 4 — two predicates, answering differently.** Discharged.
`competingSurfaceFor(document, surfaces)` returns `null` for an unknown creator over any document;
`targetingSurfaceFor(document, surfaces, eligibility)` returns `'matchCreator'` for an unknown creator
over every document the caller calls creator-eligible, and `null` over one it does not. The two also
disagree about `restore`: the competition predicate skips restore surfaces because its caller *is* the
restore, and the watcher predicate counts them because its caller is the coordinator. **What no type
establishes is that either answer is the right policy** — the asymmetry is a judgement about which
error is cheaper (over-refusing a restore costs one closed form; under-refusing a silent reload costs
somebody's work), and it is carried by the doc comments and by §4's own tests, never by the compiler.

**Entry 5 — the switch with a `never` terminus.** Discharged in both predicates. A third arm of
`WriteSurfaceTarget` is a compile error in `competingSurfaceFor` and in `targetingSurfaceFor`. **It is
a compile error nowhere else**: a third predicate written later without a switch would collapse the
arms silently, and nothing in this step prevents that. The run-time half is `EVERY_TARGET` in
`restore.test.ts` — `Object.keys` over a `satisfies Record<WriteSurfaceTarget['kind'], true>` — which
makes a new arm a compile error **in the test file** too, so an arm cannot ship with a handled switch
and no case that drives it.

**Entry 21 — `ConflictSource` is discriminated, not a structurally widened save type.** The type
exists and is discriminated; save-only evidence lives behind the `save` arm, which carries the wire
`ConflictResult` whole. **What is not discharged here is the migration**: `ConflictModel.source` is
still `ConflictResult`, and the six registration sites still pass one. 2d-5-5 owns that, and until it
lands, nothing stops a caller adding an optional top-level field to `ConflictModel` — the shape entry
21 forbids — because no code yet reads `ConflictSource`.

**Entry 22 — a save source is memoized on its `ConflictResult`.** Discharged.
`saveConflictSource(conflict)` answers the identical object for the identical wire value, so the
identity-keyed maps in `workspace.svelte.ts` will keep working when they re-key at 2d-5-5.
`externalConflictSource(observation)` is its twin, memoized for the same reason and not for symmetry:
an observation described twice must also recover one object. **Two things the memo does not give.**
"Stable" means **object identity, never value equality** — two structurally equal but distinct
refusals answer two different wrappers, and a payload round-tripped through JSON is a different key.
And **nothing forces a caller through the memo**: a hand-built wrapper of the same shape type-checks,
and it would install nothing rather than install the wrong thing, which fails safe and silently.

**Entry 23 — origin may change the messages; it may not change who installs or who offers.**
Discharged for this step's half. `conflictOriginMessage` produces a *line* per origin and
`conflictOriginMessageKey` maps it to a dictionary key; neither produces a control.
`conflictChoicesFor` and `adoptDiskVersion` were not touched, and no second producer and no second
door was added. **What that does not establish** is that a later step keeps it so: the rule lives in
prose and in the fact that only one function returns a `ConflictChoice[]`, and nothing in TypeScript
prevents a second one being written.

**One ruling deliberately left where it was.** Entry 24 — external reapply evidence being usable only
when both revisions match — is carried by the doc comment on
`ExternalConflictObservation.correspondences` and by nothing executable. There is nothing to check yet:
no code reads that field. 2d-5-5 is where the check belongs, and this record says so rather than
implying the comment is the check.

---

## 5. The four gates, measured

Every figure below was measured on this tree, unpiped, at the end of the step. The baseline this
phase started from is `1320 / 434 / 2175 / 184`.

| Gate | Before | After | Why it moved |
|---|---|---|---|
| `cargo test --workspace` | 1320 | **1320** | no Rust changed — `git diff` over `crates/` and `src-tauri/` is empty |
| `npm run check` files | 434 | **436** | two new files that enter the program: `conflictSource.ts` and its suite |
| `npm test` | 2175 | **2202** | +27 cases: **13** in `restore.test.ts`, 12 in `conflictSource.test.ts`, **2 in `scripts/lint/ipc-detail.test.ts`** — see below |
| `npm run build` modules | 184 | **185** | one new reachable `.ts` module, which is exactly `CLAUDE.md` §4's ladder |

**The +27 breakdown was wrong when this section was first written, and the third file it missed is
the interesting one.** It said *"15 in `restore.test.ts`, 12 in `conflictSource.test.ts`"*, which sums
to 27 by arithmetic and is wrong in two places at once — §1.1 said 14 for the same file, so the record
disagreed with itself. Re-derived per file rather than inferred from the total: `restore.test.ts` goes
205 → **218** (+13), `conflictSource.test.ts` contributes **12**, and `scripts/lint/ipc-detail.test.ts`
goes 128 → **130** (+2). 13 + 12 + 2 = 27, and running those three files alone reports 360, which is
218 + 12 + 130.

**Nothing was written into that third file.** It grew because its cases are generated —
`it.each(scannableFiles())` at `scripts/lint/ipc-detail.test.ts:79` — so the two new files under
`src/lib/browser/` enrolled themselves in it. That is the general shape worth carrying: **a total that
sums correctly is not a breakdown**, and in a repository with a generated suite the file that moved may
be one no author touched. The figure to re-derive is always per file, on a pristine tree.

`npm run check` reports **0 errors and 0 warnings**; `npm test` reports **58 files, 2202 passed**;
`npm run build` exits 0. The Rust figure is the sum of **26** binaries' `test result: ok` lines, all
of them `0 failed`, with `cargo test --workspace` exiting 0.

**Both bundle oracles were read, and both lines are reported** because the second exists to prove the
search can match at all (`CLAUDE.md` §4):

```
rg -c '\$\$payload|head_payload|push_element' dist/assets/index-*.js   → no match (server-only, ABSENT)
rg -c 'window\.__svelte|svelte-trusted-html'  dist/assets/index-*.js   → 2      (client-only, PRESENT)
```

**One measurement hazard, recorded because it produced a false red and would produce another.** The
Rust gate was first run twice concurrently — a background run that had not finished, plus a second
one started on top of it — and `watch_check::a_parked_worker_does_not_block_the_reap_of_a_worker_that_exited_behind_it`
and `watch_check::a_committed_save_is_suppressed_while_a_later_external_write_is_not` both **FAILED**.
Two full workspace runs exercising real filesystem watchers at once is the cause: the figure above is
from a single clean run taken after both runs and their orphaned `target/debug/deps` binaries were
killed, and both named tests pass in it. `PROGRESS.md`'s "with orphaned bin targets killed first" is
the same hazard already written down; this is a second instance of it, and the general form is that
**`cargo test --workspace` in this repository is not safe to run concurrently with itself.** No
conclusion about this step's source was drawn from the failed run, and none should be.

`cargo clippy --workspace --all-targets -- -D warnings` and `cargo fmt --check` were both run on the
final tree and both exit 0, as did the architecture-rule check
(`cargo tree -p espansoconfig-core | rg tauri` finds nothing).

**185 is the ladder's prediction and not a coincidence to be waved through.** One new `.ts` module
reachable from the entry costs one module; `conflictSource.ts` becomes reachable because
`src/lib/i18n/index.ts` imports its key builder, which is how every browser-model key builder becomes
reachable in this project. No `.svelte` file was added, so no `<style>` block was added, so the
two-per-styled-component rung does not apply here.

---

## 6. Where it is thin

Marked per `CLAUDE.md` §7.3. **No item here commissions a review round** — §7.1 is the only mechanism
and it reads a diff. **No item names a correctness defect in a source file**, so none is a blocker.

1. **Five of the six rewritten literals in `openWriteSurfaces()` cannot execute — *recorded only*.**
   Corrected from what this item first said, which repeated §2's false coverage claim. Its one caller
   sits in the `{:else if restoring !== null}` arm of a mutually exclusive chain, so only the `restore`
   literal is reachable; the other five are carried by the compiler and by nothing else. No window
   reading is owed for the reason §2 now gives, and what is genuinely uncovered is narrower than "a
   window did not draw it": a runtime failure inside one of those five literals would be found first by
   2d-5-2, which is what makes them reachable.

2. **`targetingSurfaceFor`'s `CreatorEligibility` argument is trusted — *recorded only*.** Nothing
   forces a caller to compute it with `creatorEligibilityOf`, and a wrongly-passed
   `'notCreatorEligible'` fails in the unsafe direction. 2d-5-4 is the first caller; a test there that
   pins the pairing is the only thing that could close it, and no type can.

3. **`ExternalConflictObservation` can be assembled by hand — *recorded only*.** It is a flattened
   projection of three wire narrowings, so a value of it carries no evidence that any narrowing
   actually happened, and its fields' snapshot pairing is expressed by a comment. It is the same
   residual `ConflictModel` carried before `source` held the wire value whole, and the mitigation is
   the same: 2d-5-4's routing boundary is the one place that should build one.

4. **The two new sentences are pinned for one property, not for meaning — *recorded only*.**
   `conflictSource.test.ts` checks that the watcher line still says no save was attempted, in both
   locales, and asserts the save line does **not** carry that clause — the discriminator that stops the
   scan passing on a phrase both sentences happen to contain. Whether either sentence is the *right*
   sentence, and whether the Spanish is Spanish, is checked by nothing here — the standing limit of
   every i18n suite in this repository.

5. **`ConflictSource` has no consumer, so its fitness is untested — *recorded only*.** Every claim
   about how it will serve `conflictOrigins` and the reapply authorization memo rests on reading those
   maps, not on re-keying them. If the migration at 2d-5-5 finds the shape wrong, this step's tests
   will all still pass.

6. **`restore.ts` now imports `matchCreation.ts` — *actionable*, and not a defect.** It is a real new
   edge in the module graph and it was checked for a cycle (`matchCreation.ts` reaches nothing that
   reaches `restore.ts`) and for the module count (`matchCreation.ts` was already reachable, so the
   count moved by one and not by two). The check that a later phase may want to run is whether the
   surface vocabulary should move out of `restore.ts` altogether once 2d-5-2's registry exists — the
   union is no longer only about restore, and `restore.ts` is where it lives for historical reasons.
   That is a phase decision, not work this step owes, and the step closes without it.

---

## 7. The review, and what it left to Phase 2d-5-1-A

The phase's one adversarial review is [`docs/reviews/phase-2d-5-1.md`](../reviews/phase-2d-5-1.md).
**Verdict: `ship-with-fixes`, no blockers** — it found no correctness defect in a source file. Four
should-fix findings, dispositioned here:

| Finding | Where | Disposition |
|---|---|---|
| The §2 coverage claim is false — five of six literals unreachable | this record | **fixed here** (§2, and §6 item 1) |
| The +27 breakdown is wrong and omits a third file | this record | **fixed here** (§5, and §1.1) |
| `coordinator()`'s filter disagrees with production `invalidateEverySurface` | `restore.test.ts` | **carried to 2d-5-1-A** |
| `targetingSurfaceFor` lets an earlier unknown creator shadow an exact match | `restore.ts` | **carried to 2d-5-1-A** |

**The first two were fixed in this record and the last two were not fixed here, and the reason is a
rule rather than a preference.** Both prose fixes change no source file, so `CLAUDE.md` §7.1
commissions nothing and 2d-5-1 closes. The other two findings name source files, so fixing them here
would commission a review round — and this phase's workflow allows exactly one review invocation,
already spent. `CLAUDE.md` §7.4 says what happens then in as many words: **a source fix the cap leaves
unreviewed becomes a new corrective phase carrying that review**, with its own acceptance criteria,
its own commit and its own mandatory review. That phase is **2d-5-1-A**, and it is not a phase split
to reset a counter — what justifies it is two named source changes that are still deliverable work.

**Neither carried finding is a live correctness defect, and that is why 2d-5-1 is complete rather than
`BLOCKED`.** The `coordinator()` divergence is inert — no case in the suite drives an unknown-target
creator through `close()`, because no production caller constructs one yet. The shadowing in
`targetingSurfaceFor` is a Low the review itself called harmless for the yes/no question the predicate
answers today; it has no consumer at all until 2d-5-4, and what it would cost then is a misleading
*kind* in a sentence, never a wrong yes or no. Both are still worth fixing before a consumer exists,
which is exactly what 2d-5-1-A is for.
