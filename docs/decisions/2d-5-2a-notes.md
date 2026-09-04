# Phase 2d-5-2a — the coordinator-owned write-surface registry, with nothing drawn

**Status: complete.** The first of the three-way split of 2d-5-2 the orchestrator took: **(a)** the
keyed registry as a value, with no component touched — this step; **(b)** the `DetailPane` exhaustive
assembly, `MatchCreator` reporting its destination upward, and the phase's whole mounted evidence;
**(c)** the narrow window regression reading. The split follows this project's own 2c-5-4a/4b
precedent — *"the coordinator wiring, with nothing drawn"*, then *"the screen and the phase's whole
mounted evidence"*.

The consult that binds it is [`docs/reviews/phase-2d-5-design.md`](../reviews/phase-2d-5-design.md);
where this record and that document disagree, the consult wins. Its restatement is
[`docs/decisions/2d-5-split-notes.md`](2d-5-split-notes.md), whose §3 rulings 1-5 and §6 items 1-2 are
the parts this step answers.

**Nothing under `crates/` or `src-tauri/` changed, and no `.svelte` file changed.**

> **Corrected by Phase 2d-5-2a-A.** This step's one adversarial review
> ([`docs/reviews/phase-2d-5-2a.md`](../reviews/phase-2d-5-2a.md)) returned three should-fix findings,
> and [`2d-5-2a-A-notes.md`](2d-5-2a-A-notes.md) is the phase that applied them. Two of the three named
> **this record**, so the sections they named carry correction blocks below: §3.5 and §7 item 4
> (finding 1 — the generation claimed a guarantee the code did not give), §3.8 (finding 2 — *"the safe
> one costs nothing"*), and §4, which describes two guards whose shape 2d-5-2a-A changed. **Every figure
> in §6 and every line count in §1.1 is 2d-5-2a's own measurement of 2d-5-2a's tree** and is left as it
> was written; 2d-5-2a-A's §4 measures the tree after the fixes.

---

## 1. What shipped

**One new module, one new suite, and three new members on `BrowserState`.**

1. **`src/lib/browser/writeSurfaceRegistry.ts`** — the registry as a value: a keyed live set, a lease
   per registration, an in-place target replacement, a monotonic generation, a reader that produces
   the `readonly OpenWriteSurface[]` the two 2d-5-1 predicates already take, and a per-kind lookup of
   the stored transition. Plain TypeScript, no runes.

2. **`src/lib/browser/writeSurfaceRegistry.test.ts`** — 22 model cases, including the two that drive a
   caller-supplied accessor re-entering the registry mid-operation (§4).

3. **`BrowserState` owns one registry** (`src/lib/browser/workspace.svelte.ts`) and exposes
   `registerWriteSurface`, `openWriteSurfaces()` and `writeSurfaceGeneration()`. The instance is
   created in `createBrowserState` beside the other per-state bookkeeping.

**What did not change, deliberately, and each has a reason below.** No component: not `DetailPane`,
not `MatchCreator`, not one of the six write surfaces. No exhaustiveness assembly anywhere (§3.6).
No rerouting of `BrowserState.restoreDocument`, which still takes its `surfaces` array from its
caller — the caller that would change is a component, so it is 2d-5-2b's (§3.7). No transition is
ever called by anything (§3.3). `open()` does not clear the registry (§3.8).

### 1.1 Files

| File | What changed |
|---|---|
| `src/lib/browser/writeSurfaceRegistry.ts` | **new** — 441 lines, the registry and its vocabulary |
| `src/lib/browser/writeSurfaceRegistry.test.ts` | **new** — 421 lines, 22 cases |
| `src/lib/browser/workspace.svelte.ts` | 106 insertions, 1 deletion (a closing brace that gained a comma): one import, one `const writeSurfaces`, three interface members and their three implementations |

---

## 2. The decision the orchestrator took, and this record's reasons for it

`2d-5-split-notes.md` §6 item 2 left *where the coordinator lives* open — `workspace.svelte.ts`
(already 3 588 lines) or a new module beside it — and marked it *recorded only*, since both satisfy
every ruling. **The orchestrator decided a new module for this step**, and the two reasons are in the
module's own header so a reader meets them where the code is:

- **`workspace.svelte.ts` was already 3 588 lines when this step began** — 3 693 after this step's own
  wiring — and 2d-5-3, 2d-5-4 and 2d-5-5 each add more coordinator machinery to it.
- **A plain-TypeScript registry is model-testable without mounting anything**, which is exactly what
  lets 2d-5-2b spend its whole evidence budget on the components. A `.svelte.ts` module would have
  bought reactivity nothing reads.

**What that decision does not settle.** It says nothing about where the *drain pump* and the
*observation transitions* live — 2d-5-3 and 2d-5-4 decide that for themselves, and this module being
separate neither forces nor forbids their doing the same.

---

## 3. The signatures, and why each is what it is

### 3.1 `registerWriteSurface(surface, transition)` — the consult's signature, unchanged

The consult writes it out (`docs/reviews/phase-2d-5-design.md:42`) and this step takes it literally.
The surface carries its own kind, so **there is no key argument that could disagree with the value**,
and the registry keys on `surface.kind`.

### 3.2 The lease is the returned function, and `replaceTarget` hangs on it

`UnregisterWriteSurface` is **callable, with one property**. Calling it unregisters; `replaceTarget`
on it reports a file. Two reasons, neither of them tidiness:

- It keeps the consult's return type spelled as the consult spelled it, and it is **directly usable as
  what a Svelte host returns from `$effect` or `onMount`** as its cleanup, so the disposal path
  2d-5-2b writes is one `return` with nothing to forget.
- Hanging the target replacement on the same value means **there is no second token a caller could
  pair with the wrong registration** — the shape `sendRestore(started)` already uses in
  `./restore.ts`, where taking a session beside the permit let a caller pair a permit with a session
  it was not minted for.

The alternative considered and rejected was a `WriteSurfaceLease` object with `unregister()` and
`replaceTarget()` methods. It is plainer to read, and it closes the pairing hazard just as well —
a lease names its own entry in either shape. What it costs is the consult's own spelling of the
return type and the one-`return` disposal: a host would have to write `() => lease.unregister()`, and
forgetting that wrapper is a defect no type catches.

**What the lease forces, and what it does not.** It forces that a stale instance can neither remove
nor re-target a newer one, and that a second call changes nothing. **Nothing in TypeScript forces a
caller to invoke it at all** — a host that drops it leaves its surface registered for the life of the
registry — so disposal is asserted by test (2d-5-2b's mounted evidence) and never claimed by type.
That is §3 ruling 2 said in the code, in the same sentence as what the code does force.

### 3.3 `WriteSurfaceTransition` — the narrowest honest type, with no caller

`(observation: ExternalConflictObservation) => void`.

- **The parameter** is 2d-5-1's already-narrowed `Changed`/`Addressable`/`Projected` snapshot, which
  is the value the consult says is sent (`docs/reviews/phase-2d-5-design.md:149-152`). A narrower
  parameter would hand a surface less than the consult says it gets; a wider one would claim a
  protocol nobody has designed.
- **The answer is `void`** because nothing has decided what a surface answers. Inventing a return type
  here would be a claim about a protocol that does not exist; widening `void` later is one edit in one
  file.
- **No caller invokes it.** 2d-5-4 is the step that routes an admitted observation to a surface, and
  2d-5-5 is where the six existing conflict registrations are generalized onto `ConflictSource`. Until
  then the registry stores one per entry and calls none, and the module's own doc comment says so.

The stored value would otherwise be unreachable, so `transitionFor(kind)` exists on the registry — the
per-kind lookup 2d-5-4 needs, keyed the way `targetingSurfaceFor` answers. **It is deliberately not on
`BrowserState`**: it has no caller there, and 2d-5-4 lifts it when it has one.

### 3.4 `replaceTarget(target: WriteSurfaceDocumentTarget)` — the document arm only

**In place** is the whole point: the entry keeps its key, its lease, its transition and its position
in the reader's order — no re-keying, and the lease that reported the file can still remove the entry
afterwards, which the suite pins. It is what the creator's unknown-to-known transition needs.

**The parameter is the document arm rather than the whole `WriteSurfaceTarget`**, because
`OpenWriteSurface` lets only `matchCreator` carry an unknown target: a wider parameter would need
either a cast to build an unrepresentable surface for the other six kinds, or a third refusal arm for
something no caller wants. **The cost is named rather than hidden**: a surface that must go back to
naming no file cannot say so through the lease and has to unregister and register again — a re-key,
where by design the newest registration wins. Today's `MatchCreator` has no transition back to *no
destination* (`chooseDestination` in `./matchCreation.ts` takes a `DocumentId`), so nothing needs it.

**It answers `'replaced' | 'staleLease'` rather than nothing**, because a report that did not land
looks exactly like one that did from the caller's side, and believing a report landed when it did not
is this project's silent-success defect class. **The unregister answers nothing**, and the asymmetry
is deliberate: a host disposing of its surface wants the entry gone and it is gone either way, so an
answer there would be a value with nothing to do about it — and a discarded consuming answer is the
shape this project has shipped as a defect twice. **Nothing forces a caller to read the replacement's
answer.**

### 3.5 The generation, and what a move does not imply

`generation()` moves for **all three** mutating operations — a registration, an unregistration that
removed an entry, and a target replacement that landed — and **does not move for a no-op**: a second
call of one lease's unregister, a stale lease's unregister, a stale lease's `replaceTarget`. A
replacement that reports the same document it already held **does** move it: the rule is about the
operation, not about whether the value differs, because comparing values would be a second rule that
can drift from this one. There is a case for each of those.

**What a moved generation implies**: the live set was mutated since the capture, so an answer derived
from an older snapshot may describe surfaces that are no longer open or miss one that now is. **What
it does not imply**: which entry changed, that any particular document is involved, or that the set
now differs from the capture — registering a surface and unregistering it moves the counter twice and
leaves the set exactly as it was, which the suite pins. That is the guard the consult asks a
coordinator to capture before an await and recheck immediately before it installs
(`docs/reviews/phase-2d-5-design.md:157-163`), and its meaning is *this decision was made over a set
nothing has touched*, which is deliberately stricter than *the set still looks the same*.

> **Correction — Phase 2d-5-2a-A, review finding 1.** The last sentence above was **false as written
> at 2d-5-2a**, and it is this project's worst defect class: a record claiming a guarantee the code did
> not give. The counter moves for registry *operations* only, and at 2d-5-2a the registry stored the
> caller's own object (§4's last paragraph, and §7 item 4), so a host mutating its registered surface's
> `target` in place changed what `openWriteSurfaces()` answered **with the generation unmoved** — which
> is exactly the case consult Q5's guard rests on, the *unmoved* one.
>
> **2d-5-2a-A made the sentence true rather than weakening it.** `registerWriteSurface` now reads the
> caller's object once, in a fixed order, and stores a frozen copy it built itself, so nothing a caller
> retains can change what a reader sees. An unmoved generation therefore means *no registry operation
> happened between the capture and this decision*, and that is now a true statement about what a reader
> sees. **What it still does not say**, in the same breath: nothing forces a host to register at all,
> so an unmoved counter over an empty registry says nobody registered and not that no write surface is
> open; and a `DocumentId` a stored surface names can be reallocated by `open()` with no registry
> operation at all (§3.8's own correction), so the counter does not promise that a surface still names
> the file it named.

### 3.6 The reader, its order, and the exhaustiveness that is not here

`openWriteSurfaces()` answers a **fresh array each call**, holding the surface objects as they were
registered — *corrected by 2d-5-2a-A: it holds the registry's own frozen copies of them, never the
caller's objects; see §3.5's correction* — **in registration order, oldest first** — with the property that a registration displacing
a live entry of the same kind **keeps that entry's position** rather than moving to the end (`Map.set`
over an existing key). That is stated in the doc comment because a predicate depends on it:
`targetingSurfaceFor` says array order decides which kind it answers when two open surfaces name one
file. It decides **no yes/no answer** of either predicate.

**No `satisfies Record<OpenWriteSurfaceKind, …>` assembly was added anywhere by this step.** The
consult puts the one exhaustive assembly in the composition file, which is a component, so it is
2d-5-2b's; a second one here would be a check in the wrong place. The consequence is written into the
suite where the seven kinds are listed: an eighth kind would be missing from that list silently, and
what catches it is `restore.test.ts`'s own `EVERY_SURFACE` table, which **is** `satisfies`-checked and
fails to compile when a kind is added without an entry.

**At most one live entry per kind**, which is what the key buys and what it costs: two surfaces of one
kind cannot both be represented. Today the third pane cannot produce that — it holds exactly one block
per kind inside one `if`/`else` chain (`src/lib/components/DetailPane.svelte:844-961`) — which is the
same ground `competingSurfaceFor`'s own comment stands on for restore.

### 3.7 What `BrowserState` gained, and what it did not

Three members: `registerWriteSurface`, `openWriteSurfaces()` and `writeSurfaceGeneration()`. All three
delegate straight to the registry with no check of their own, because a check there would be a second
rule that can drift from the registry's.

**`restoreDocument` was not rerouted.** It still takes `surfaces: readonly OpenWriteSurface[]` from
its caller, and `DetailPane.svelte`'s own `openWriteSurfaces()` still assembles that array from what
the pane has open. Routing it through the registry is the natural seam and it is **deliberately not
taken here**: the caller that would change is a component, and this step touches none. Until 2d-5-2b
does it, **`BrowserState.openWriteSurfaces()` answers nothing in production** — no component
registers.

### 3.8 `open()` does not clear the registry

`open()` clears documents, projections, selection, the viewer and the per-document projection
generations. It deliberately does **not** clear the registry: a component owns its registration and
unregisters through its lease when it closes, so clearing here would make a still-open surface
invisible while its component went on holding an inert lease. That is the **unsafe** direction —
*"no surface is open"* is exactly the answer that would later permit a silent reload — and the safe
direction costs nothing, because a workspace that has really been replaced unmounts the surfaces whose
hosts then unregister. **Nothing enforces that unmounting-and-unregistering**, which is why 2d-5-2b's
mounted evidence is where disposal is established.

> **Correction — Phase 2d-5-2a-A, review finding 2.** *"The safe direction costs nothing"* was false,
> and the contradiction was 586 lines further down the same file it describes: `open()` clears
> `projectionGenerations` because **the identities of the documents it holds are reallocated by the
> load below it** (`workspace.svelte.ts:2269`). A registration that survives an `open()` therefore
> names a `DocumentId` that now denotes a **different file**, and two things follow:
> `competingSurfaceFor` refuses a restore of a file nobody has open, and `targetingSurfaceFor`
> attributes that file to a surface that is not about it. Both are refusals rather than permissions, so
> **a write is still safe** — the cost is a false refusal over an unrelated file, which is not nothing.
>
> **The decision itself stands and 2d-5-2a-A changed no behaviour**: `open()` still does not clear the
> registry, because the caller that would have to change is a component and that is 2d-5-2b's. What
> changed is the sentence, here and in the comment the finding named. The cost is **inert at 2d-5-2a**,
> where nothing registers and the registry is empty across an `open()` by construction, and **live at
> 2d-5-2b**, where hosts register.

> **Correction on the block above — Phase 2d-5-2a-B, 2026-09-04, review 2 finding 3.** Its citation
> `workspace.svelte.ts:2269` **was already wrong when the block was committed**, and by the block's own
> doing: `:2269` is where the sentence sat at `15ada19`, and 2d-5-2a-A's replacement for the `open()`
> comment is seventeen lines longer than what it replaced, so the same commit that wrote this citation
> moved the line to `:2286`. Both numbers were checked against the two commits rather than reasoned
> about.
>
> Re-derived on the tree Phase 2d-5-2a-B leaves, where a further twenty lines of doc comment on
> `BrowserState.registerWriteSurface` have moved it again: *"Their identities are reallocated by the
> load below"* is at **`src/lib/browser/workspace.svelte.ts:2306`**, in the comment block at
> `:2305-2309`, above the `projectionGenerations.clear()` it explains at **`:2310`**. The quoted text is
> what makes that recoverable when the number moves next; the number alone is not.
>
> The block's own "586 lines further down" is **dropped rather than re-derived**. It is a subtraction of
> two line numbers in a file every later step of 2d-5 edits, so it goes stale for reasons that have
> nothing to do with what it claims — which is the shape of the finding this correction answers.
>
> **The claim itself is unaffected and stands.** Only the pointer was wrong.

---

## 4. Two re-entrancy guards nothing asked for, and why they are in

`CLAUDE.md` records that **a check and a spend separated by any property read are not atomic**,
because a property read runs arbitrary code through a getter or a proxy trap and `readonly` does not
freeze at run time. Two places in this module read a **caller-supplied** object, so both were ordered
against that hazard rather than assumed safe, and each has a test that produces the re-entry through an
accessor:

1. **`registerWriteSurface` reads `surface.kind` before it takes a serial.** If that read re-enters and
   registers another surface of the same kind, the re-entrant registration takes a *lower* serial and
   lands first, so this call — which finished last — is the newest one and wins. Taking the serial
   first would have let the re-entrant registration be silently clobbered by the older number.

2. **`replaceTarget` re-checks the lease after building the replacement.** `withTarget` reads `kind`
   off the surface the caller registered; if anything re-entered during that read and replaced this
   kind's entry, the entry object is no longer the one that was checked and the call answers
   `staleLease` rather than writing an older registration back over a newer one.

Both are exotic, and both are cheap. What they are **not** is a general defence: the surface value is
still held as it was handed, so a caller that mutates the object it registered changes what the reader
answers about it, and nothing in this module can see that.

> **Correction — Phase 2d-5-2a-A, findings 1 and 3.** Both halves of this section describe code that no
> longer exists, and the last paragraph repeats finding 1's false sentence.
>
> **Guard 1 is unchanged in reason and wider in reach.** `registerWriteSurface` still reads before it
> takes a serial, for exactly the reason above, but it now reads *everything* the caller can be asked —
> `kind`, `target`, that target's `kind`, and on the document arm its `document` — before the serial and
> before the map is touched. So after the serial there is no caller-supplied read left in that path at
> all.
>
> **Guard 2 is gone, and what replaced it is stronger.** `replaceTarget` no longer builds between two
> lease checks; it reads the caller's `target.document` **first**, builds the registry's own value, and
> only then checks the lease and writes — one synchronous block with nothing caller-supplied between
> the check and the spend, which is the shape `CLAUDE.md` asks for rather than a second check after
> one. A re-entry during that read is already done when the check runs, so the outcome is the same
> `staleLease` the old ordering produced, and the suite's case still pins it — driven now from the
> **reported target's** accessor, since `surface.kind` is no longer read twice. Keeping the second check
> would have been a guard nothing could fire, documented as if it could.
>
> **The last paragraph is false as written.** A registered surface is now the registry's own frozen
> copy, so a caller that mutates what it registered changes nothing a reader sees. What is still true is
> the narrower sentence in §7 item 4's correction.

> **Correction on the block above — Phase 2d-5-2a-B, 2026-09-04, review 2 finding 1.** *"The outcome is
> the same `staleLease` the old ordering produced, and the suite's case still pins it"* is false as
> stated, and it is the same defect class the block it sits in was written to close. Two things are
> wrong with it.
>
> **The suite's case is not evidence that the outcomes agree; it is evidence that they differ.** The
> case at `writeSurfaceRegistry.test.ts:520-544` drives a re-entrant **registration** from the reported
> target's accessor. The old ordering never read `target.document` — `withTarget` stored the caller's
> target object by reference — so against `15ada19`'s module that accessor never fires inside the call
> and the outer answer is `'replaced'`. The case is one of the seven the fix round measured as failing
> against the pre-fix module, not one it "still pins".
>
> **And on a re-entrant same-lease `replaceTarget`, the new ordering answers `'replaced'` twice.** The
> serial is unchanged by a target replacement, so the outer call's `heldBy` matches, the outer writes
> its own target over the inner one and both calls report success. The old ordering's own route — a
> `kind` accessor on the retained registered surface — refused the outer call instead and left the
> inner target installed. The outcomes are different; the new one is right, and last-finisher-wins is
> this module's registration rule seen through a lease.
>
> The derivation, measured by running both modules rather than by reading them, is
> `docs/decisions/2d-5-2a-A-notes.md` §4's own correction block and
> `docs/decisions/2d-5-2a-B-notes.md` §2. **No behaviour changed for this**: the ordering shipped at
> 2d-5-2a-A stays.

---

## 5. The binding rulings this step touched, and what each does not guarantee

| Ruling | What this step did | What it does not establish |
|---|---|---|
| §3 ruling 1 — the coordinator owns the live registry | The registry exists and `BrowserState` owns one | The `DetailPane` half of ruling 1 — the exhaustive assembly — is 2d-5-2b's and is absent here |
| §3 ruling 2 — a lease, not a bare kind key | The lease, its idempotence and its inertness once displaced, all pinned by tests | That any host ever calls it; no type forces disposal |
| §3 ruling 3 — one discriminated union | Consumed unchanged; the registry stores and answers `OpenWriteSurface` values | Nothing here re-tests 2d-5-1's union or its `never` arms |
| §3 ruling 4 — two predicates answering the unknown arm differently | Driven over a registry-produced array, before and after a reported destination | Their own behaviour is 2d-5-1's, established by `restore.test.ts` |
| Consult Q5 — capture the registry generation | The generation exists, with its three movers and its no-ops | **No coordinator captures it**; that is 2d-5-4's, and nothing here tests a recheck |

---

## 6. The four gates, measured

Every figure below was measured on this tree at the end of the step, each command run **on its own**.
The three frontend baselines were **re-derived on a pristine `git archive HEAD` copy** rather than
copied from `PROGRESS.md`, which is what `CLAUDE.md` §4 asks for a count a working tree cannot produce.

| Gate | Before | After | Why it moved |
|---|---|---|---|
| `cargo test --workspace` | 1320 | **1320** | nothing moved — `git diff --stat HEAD -- crates/ src-tauri/` is empty, and the suite was run anyway |
| `npm run check` files | 436 | **438** | the two new files, both of which enter the program |
| `npm test` | 2205 | **2229** | +24: **22** in `writeSurfaceRegistry.test.ts`, **2** in `scripts/lint/ipc-detail.test.ts` |
| `npm run build` modules | 185 | **186** | one new reachable `.ts` module, which is exactly `CLAUDE.md` §4's ladder |

**The +24 was re-derived per file, not inferred from the total.** Running the new suite alone reports
**22**. The other **2** were written by nobody: `scripts/lint/ipc-detail.test.ts:79` generates its
cases with `it.each(scannableFiles().filter(…))` — one per `.ts` or `.svelte` file under `src/` that is
not on its two-entry allow list — so the two new files enrolled themselves in it, 130 → 132. The per-file comparison was taken twice, once against the
pristine HEAD copy's own JSON report and once against this tree's, and those two files are the only
two rows that differ.

`npm run check` reports **0 errors, 0 warnings** over 438 files. `npm test` reports **59 files, 2229
passed, 0 failed**. `npm run build` exits 0. The Rust figure is the sum of the `test result:` lines of
a single clean `cargo test --workspace`, **1320 passed, 0 failed**, exit 0, run once with no other
Cargo process alive — the concurrency hazard `2d-5-1-notes.md` §5 records was respected and no
concurrent run was taken.

`cargo clippy --workspace --all-targets -- -D warnings` and `cargo fmt --check` both exit 0, as does
the architecture-rule check: `cargo tree -p espansoconfig-core | rg tauri` finds nothing.

**Both bundle oracles were read, and both lines are reported** because the second exists to prove the
search can match at all (`CLAUDE.md` §4):

```
rg -c '\$\$payload|head_payload|push_element' dist/assets/index-*.js   → no match (server-only, ABSENT)
rg -c 'window\.__svelte|svelte-trusted-html'  dist/assets/index-*.js   → 2      (client-only, PRESENT)
```

**186 is the ladder's prediction rather than a number waved through.** One new `.ts` module reachable
from the entry costs one; `writeSurfaceRegistry.ts` becomes reachable because `workspace.svelte.ts`
imports it. No `.svelte` file was added, so the two-per-styled-component rung does not apply.

**`git status --short` shows no `.svelte` path**: one modified file (`workspace.svelte.ts`) and two new
ones.

---

## 7. Where it is thin

Marked per `CLAUDE.md` §7.3. **No item here commissions a review round** — §7.1 is the only mechanism
and it reads a diff. **No item names a correctness defect in a source file**, so none is a blocker.

1. **Nothing in this repository registers a surface — *recorded only*.** Every case in the new suite
   drives the registry directly, so what is established is the registry's behaviour over values and
   nothing about a component's lifecycle. Whether a host registers on mount, unregisters on destroy,
   reports its destination, or does any of those twice is **entirely** 2d-5-2b's mounted evidence, and
   a green suite here would look identical if no component ever called any of it.

2. **The seven-kind list in the new suite is not exhaustiveness-checked — *recorded only*, and
   deliberate.** Requirement and consult both put the one `satisfies Record<OpenWriteSurfaceKind, …>`
   assembly in the composition file. An eighth kind would be missing from this file's list silently;
   what fails is `restore.test.ts`'s checked table, in a different file, which is a real check but not
   this file's.

3. **`transitionFor` has no production caller and its shape is untested against a real need — *recorded
   only*.** It is keyed by kind because that is what `targetingSurfaceFor` answers, and the race
   between "a snapshot justified this kind" and "this lookup answers the newer surface's transition" is
   documented and guarded by nothing. If 2d-5-4 finds it needs the transition *paired* with the surface
   in one snapshot, this step's tests all still pass.

4. **A registered surface object is held, not copied — *recorded only*.** `readonly` does not freeze at
   run time, so a caller that mutates what it registered changes what the reader answers. Copying would
   be shallow and would carry the same caveat one level down, so the module says what it does instead.

   > **Correction — Phase 2d-5-2a-A, review finding 1.** This item recorded the hazard and **failed to
   > connect it to consult Q5's guard**, which is why it was marked *recorded only* rather than treated
   > as the defect it was: mutation-in-place is the one way the live set's *content* changes with the
   > generation unmoved, and the guard is a recheck of exactly that unmoved case (§3.5's correction).
   > The reasoning that a copy "would be shallow and carry the same caveat one level down" was the
   > wrong conclusion drawn from a true premise — a shallow copy is indeed not enough, because `target`
   > is an object, which is why the copy 2d-5-2a-A built goes one level down and freezes both objects.
   > The registry now stores its own value and answers it, so the item is **closed, not carried**.
   >
   > **What replaces it, and it is narrower.** A copy freezes the `DocumentId` a surface names, never
   > what that number denotes — `open()` reallocates document identities without any registry operation
   > — so the registry can hold a perfectly immutable surface that is about a file which no longer
   > exists under that identity. That is §3.8's correction, and it is *recorded only*: no consumer of it
   > exists until 2d-5-2b.

5. **`BrowserState.openWriteSurfaces()` and `restoreDocument`'s `surfaces` argument are two answers to
   one question — *actionable*, and not a defect.** They will disagree until 2d-5-2b routes the pane
   through the registry: today the registry is empty in production and the pane's own array is the live
   one, so nothing consumes the disagreement. The check a later step can run is that the pane has
   exactly one producer once 2d-5-2b lands; leaving two would be the shape §7.3 calls a defect in
   source, and it is 2d-5-2b's acceptance criterion rather than this step's.

6. **The re-entrancy guards of §4 are tested through accessors, which is not how a component behaves —
   *recorded only*.** The two cases establish that the orderings hold under a re-entrant read; they do
   not establish that any realistic caller can produce one, and no window has been opened on this
   module at all.

7. **The surface vocabulary still lives in `restore.ts` — *recorded only*, inherited.**
   `2d-5-1-notes.md` §6 item 6 nominates moving `OpenWriteSurface` and its two predicates out of that
   module now that they are no longer only about restore; this step imports them from where they are
   and takes no position. It remains a phase decision, and this module's existence neither forces nor
   blocks it.
