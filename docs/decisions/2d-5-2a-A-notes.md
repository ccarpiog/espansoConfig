# Phase 2d-5-2a-A — the three fixes Phase 2d-5-2a's review returned, applied

**Status: implemented; its own review is what closes it.** Phase 2d-5-2a shipped the coordinator-owned
write-surface registry and its one adversarial review
([`docs/reviews/phase-2d-5-2a.md`](../reviews/phase-2d-5-2a.md)) returned **`ship-with-fixes`, 0
blockers, 3 should-fix**. Those three were deliberately **not** applied inside 2d-5-2a, so that what was
committed there is exactly what was reviewed. **This phase applies all three**, and nothing else.

Two of the three were **records claiming a guarantee the code did not give** — this project's named
worst defect class, and the one no test can fail. The third was the same discipline seen from the other
end: a caller-supplied property read a second time after the code had already acted on the first read.

**Nothing under `crates/` or `src-tauri/` changed** (`git diff --stat HEAD -- crates/ src-tauri/` is
empty, and §5 runs the Rust suite anyway), **no `.svelte` file changed**, no new module was added, no
`satisfies Record<OpenWriteSurfaceKind, …>` assembly was written, `restoreDocument` was not rerouted and
`open()` still does not clear the registry. **The last three are 2d-5-2b's** and were left alone by
instruction; the first two are simply not this phase's work.

---

## 1. Files

| File | What changed |
|---|---|
| `src/lib/browser/writeSurfaceRegistry.ts` | findings 1 and 3: the registry stores its **own frozen copy** of a surface, built from one read of each caller-supplied property in a stated order; `withTarget` is replaced by `ownedSurface`/`ownedDocumentSurface`; `replaceTarget` uses the **captured** kind and no longer re-reads any surface's `kind`; **seven** doc comments corrected — the module header, `replaceTarget`, `registerWriteSurface`, `openWriteSurfaces`, `generation`, `LiveRegistration.surface` and `heldBy` — and two written for the new functions (441 → 565 lines, most of it prose) |
| `src/lib/browser/writeSurfaceRegistry.test.ts` | **+6 cases** (22 → 28) and one case rewritten, because its premise — a second read of `surface.kind` — no longer exists (421 → 609 lines) |
| `src/lib/browser/workspace.svelte.ts` | finding 2: the registry's `open()` comment now names **identity reallocation** and states the two costs. **Comment only** — no statement, no expression and no type changed (3 693 → 3 710 lines) |
| `docs/decisions/2d-5-2a-notes.md` | correction blocks on §3.5 and §7 item 4 (finding 1), §3.8 (finding 2), §4 (findings 1 and 3 together: it describes two guards whose shape changed), one inline correction in §3.6, and a pointer under the status line |

`src/lib/browser/workspace.svelte.ts` is a **`.ts` module**, not a Svelte component: it is the only path
in `git status --short` containing the string `.svelte`, and the acceptance criterion — *no `.svelte`
file modified* — holds. No component, no markup, no prop and no reactive statement was touched, so **no
window reading is owed or was taken**, exactly as at 2d-5-2a.

---

## 2. Finding 1 — the generation claimed a guarantee the code did not give

### 2.1 What it was

`writeSurfaceRegistry.ts:245-249` said the Q5 recheck's meaning is *"this decision was made over a set
nothing has touched"*. The counter moves only for registry **operations**, and the same file's header
said surface values were **held by reference** — so a host that mutated its own registered surface's
`target` in place changed what `openWriteSurfaces()` answered **with the generation unmoved**. The
consult's Q5 guard (`docs/reviews/phase-2d-5-design.md:157-163`) is a recheck of exactly that unmoved
case, so the false direction was the load-bearing one. `2d-5-2a-notes.md` §3.5 repeated the sentence
verbatim and §7 item 4 recorded the by-reference hazard **without connecting it to the guard**, which is
why it was marked *recorded only* rather than treated as what it was.

### 2.2 The decision: make the sentence true, not weaker

The orchestrator's ruling, and this record's reason for agreeing with it: weakening the doc would have
left the guard consult Q5 depends on carrying a caveat that no coordinator could act on. *"The
generation is unmoved, but a surface may have changed anyway"* is not a guard — a coordinator reading it
has nothing to do about it, since it cannot observe the mutation either. **The registry stores its own
copy instead**, and the sentence becomes true.

### 2.3 What shipped

`registerWriteSurface` reads the caller's object **once per property, in a stated order** — `kind`, then
`target`, then that target's `kind`, then, on the document arm, its `document` — and builds the stored
`OpenWriteSurface` itself, member by member, from what those reads answered.

**A shallow copy would not have been enough, and that is the substance of the fix rather than a detail.**
`target` is an object of its own, so copying only the surface leaves `target.document` mutable through
the caller's retained reference — which is the exact defect the finding named, one level down.
`ownedDocumentSurface` builds **both** objects and freezes **both**, because `Object.freeze` is shallow.

**Freezing is the second half, and it answers a hazard the finding did not name.** The reader hands its
stored objects out, so a *consumer* that casts `readonly` away could have corrupted the live set even
after the copy closed the *producer* side. Frozen, that write is a `TypeError` in strict mode instead.

**The reads all happen before the serial is taken**, which preserves — and widens — the ordering
2d-5-2a already had for `surface.kind` alone: a read that re-enters and registers another surface of
this kind takes a *lower* serial and lands first, so this call, which finished last, wins. After the
reads there is **no caller-supplied read left in the registration path at all**, so nothing can run
between the serial and the `live.set`.

### 2.4 The unrepresentable pairing, decided rather than coerced

A `kind` other than `matchCreator` read together with a `target.kind` of `'unknown'` is **not a value of
`OpenWriteSurface`**. Reaching it takes a caller that has defeated the compiler — a cast, or an accessor
whose answer differs from its declared type — but the registry has to do *something*, and the honest
options were: invent a document; store something no consumer can narrow (a cast, forbidden); drop the
registration silently; or refuse.

**It throws a `TypeError`, before the serial is taken and before the map is touched**, so a refused
registration leaves the registry exactly as it was and moves no generation. Dropping it silently was the
one option that had to be rejected on safety and not on taste: an invisible surface is precisely the
answer that permits a silent reload, which is the same argument `open()` not clearing the registry rests
on. The message is a programmer's; nothing renders it, so **it is not a string the i18n rule is about**,
and the doc comment says so where the decision is.

**Both representable pairings are tested for positively, which is the part that is easy to get wrong.**
A `target.kind` that is *neither* `'document'` nor `'unknown'` is the same problem arriving by a
different route, and an `if`/`else` written against one arm alone would coerce it into the other — an
untyped `'whatever'` becoming a destination-less creator, silently. `ownedSurface` asks for each
representable pairing and throws on everything else, and the suite drives both routes.

### 2.5 The cases, and that they discriminate

Four new cases in a new `describe('the copy the registry keeps')` — a host's retained object is mutated
in `target.document`, `target.kind` and `kind` and the reader is unmoved (with `competingSurfaceFor`
driven over the answer, since the predicate is what actually consumes it); a target reported through a
lease is mutated afterwards and the reader is unmoved; the answered surfaces and their targets are
frozen and a cast-away write throws; the unrepresentable pairing throws and changes nothing. A fifth, in
the generation suite, is the **guard's own direction**: a host mutates what it registered, the counter
does not move, **and the reader still answers the registered value**.

**They were checked against the pre-fix module rather than assumed to discriminate.** With
`git show HEAD:src/lib/browser/writeSurfaceRegistry.ts` in place and the new suite unchanged, **7 of 28
cases fail** — the six new ones and the rewritten accessor case — and 21 pass. One of them only
discriminates because of how it is written: the generation case compares the reader's answer against a
**written-out literal**, because a snapshot captured from a registry that stored the caller's object
would hold that same object and would "agree" with a mutated answer while pinning nothing.

### 2.6 What the fix does not force

- **Nothing forces a host to register at all**, so an unmoved generation over an **empty** registry says
  nobody registered — not that no write surface is open. That is `competingSurfaceFor`'s own inherited
  limitation, and it is now in the generation's own doc comment rather than only in the header.
- **A copy freezes the `DocumentId`, never what it denotes.** `open()` reallocates document identities
  with no registry operation, so a stored surface can be perfectly immutable and about a file that no
  longer exists under that identity. That is finding 2, and the two now cite each other.
- **The copy is exactly as deep as today's union.** Adding a member to an arm of `OpenWriteSurface` is a
  compile error in `ownedDocumentSurface`, which is a real force; adding a member that is *itself an
  object* would compile and would be copied by reference, and only a reader would catch it.
- **`Object.freeze` throws on a write in strict mode.** All this project's modules are strict, so the
  case can assert a `TypeError`; a sloppy-mode consumer's write would fail silently instead. Either way
  the registry is not corrupted, which is the property the fix is about.
- **Nothing in TypeScript enforces the read-once discipline** on code added later. It is held by the
  ordering, by the comments that state it, and by the accessor cases — not by a type.

---

## 3. Finding 2 — "the safe one costs nothing" was false, and the fix is prose

### 3.1 What it was

`workspace.svelte.ts:1683` argued that not clearing the registry in `open()` is the safe direction and
that *"the safe one costs nothing"*. The same file at `:2269` clears `projectionGenerations` because
*"Their identities are reallocated by the load below"*. A registration that survives an `open()`
therefore names a `DocumentId` that now denotes a **different file**: `competingSurfaceFor` refuses a
restore of a file nobody has open, and `targetingSurfaceFor` attributes that file to a surface that is
not about it. `2d-5-2a-notes.md` §3.8 named neither.

### 3.2 What changed, and what deliberately did not

**No behaviour.** `open()` still does not clear the registry: the decision stands, and the caller that
would have to change to do better is a component, so it belongs to 2d-5-2b. What changed is the comment
and the record — both now name reallocation and state the two costs, and both say that the costs are
**refusals rather than permissions**, so a *write* is still safe and the price is a **false refusal over
an unrelated file**. Both also say the cost is **inert at 2d-5-2a**, where nothing registers and the
registry is empty across an `open()` by construction, and **live at 2d-5-2b**, where hosts register.

### 3.3 What the fix does not force

It buys no safety at all: it is a sentence. The failure it describes becomes reachable the moment a host
registers, and what closes it is either a host that unregisters on unmount — which nothing enforces and
which 2d-5-2b's mounted evidence is what establishes — or a deliberate decision in 2d-5-2b about what
`open()` does to the registry. This phase makes that decision available to be taken; it does not take it.

---

## 4. Finding 3 — `withTarget` re-read `surface.kind`, and the fix subsumes it

`withTarget` read `surface.kind` a second time on the non-creator path (the creator path
short-circuited), so an inconsistent accessor could yield an entry keyed K whose stored `surface.kind`
is not K, making `transitionFor` and `openWriteSurfaces` disagree. **Finding 1's fix subsumes it**, and
this section says so explicitly rather than leaving it looking unaddressed: `withTarget` no longer
exists, `replaceTarget` builds through `ownedDocumentSurface(kind, …)` with the **captured** kind, and
no surface's `kind` is read anywhere but at registration. The key and the stored discriminant cannot
come apart.

**The re-entrancy guard changed shape, and the new shape is stronger.** 2d-5-2a's `replaceTarget`
checked the lease, built, and checked again, because the build read the caller's object. It now reads
the caller's `target.document` **first**, builds, and only then checks the lease and writes — so the
check and the spend are one synchronous block with nothing caller-supplied between them, which is the
shape `CLAUDE.md` asks for rather than a second check after one. A re-entry during that read is already
done when the check runs, so the answer is the same `staleLease` the old ordering produced. **Keeping
the second check would have been a guard nothing could fire, documented as if it could.**

**The coverage the finding named is now taken, on the path the old suite could not reach.** The review
noted that the accessor case at `writeSurfaceRegistry.test.ts:359` exercised only one read because the
creator path short-circuits. The new case registers a **non-creator** surface whose `kind` answers
`matchEditor` first and `restore` after, reports a file through the lease, and asserts the entry is
still keyed and stored as `matchEditor` and that `transitionFor('restore')` is `null`. Against the
pre-fix module that case fails, answering `restore`.

**What it does not force.** Nothing prevents a later edit from putting a caller-supplied read back
between the check and the spend; what stands there is the comment that says why not, and the case whose
re-entry is driven from the **reported target's** accessor — which is also why that case had to be
rewritten rather than kept: its old premise, a second read of `surface.kind`, no longer exists.

---

## 5. The four gates, measured

Every figure below was measured on this tree, each command run **on its own**. `npm test` was
additionally re-derived **per file** against a pristine `git archive HEAD` copy, as `CLAUDE.md` §4 asks.

| Gate | Before | After | Why it moved |
|---|---|---|---|
| `cargo test --workspace` | 1320 | **1320** | nothing moved — `git diff --stat HEAD -- crates/ src-tauri/` is empty, and the suite was run anyway |
| `npm run check` files | 438 | **438** | no file added or removed; **0 errors, 0 warnings** |
| `npm test` | 2229 | **2235** | **+6**, all in `writeSurfaceRegistry.test.ts` (22 → 28) |
| `npm run build` modules | 186 | **186** | no new module, so the ladder predicts no movement — and it did not move |

**The +6 was re-derived per file, not inferred from the total.** A `git archive HEAD` copy with
`node_modules` symlinked in was run under vitest's JSON reporter, this tree was run the same way, and
the two per-file tables were compared row by row: **59 files on both sides, and exactly one row
differs** — `src/lib/browser/writeSurfaceRegistry.test.ts`, 22 → 28. Both per-file sums equal their
reported totals (2229 and 2235). `scripts/lint/ipc-detail.test.ts` enrols one case per scannable **file**
rather than per test, and this phase added no file, so it stayed at 132 — which the row-by-row comparison
shows rather than assumes.

`npm test` reports **59 files, 2235 passed, 0 failed**. `npm run check` reports **438 files, 0 errors, 0
warnings**. `npm run build` exits 0 at **186 modules transformed**. The Rust figure is the sum of the
`test result:` lines of a single clean `cargo test --workspace` — **1320 passed, 0 failed**, exit 0, run
once with no other Cargo process alive, so the concurrency hazard `2d-5-1-notes.md` §5 records was
respected.

`cargo clippy --workspace --all-targets -- -D warnings` and `cargo fmt --check` both exit 0, as does the
architecture-rule check: `cargo tree -p espansoconfig-core | rg tauri` finds nothing.

**Both bundle oracles were read, and both lines are reported** — the second exists to prove the search
can match at all (`CLAUDE.md` §4):

```
rg -c '\$\$payload|head_payload|push_element' dist/assets/index-*.js   → no match (server-only, ABSENT)
rg -c 'window\.__svelte|svelte-trusted-html'  dist/assets/index-*.js   → 2      (client-only, PRESENT)
```

**186 unchanged is the meaningful reading of that gate here.** `CLAUDE.md` warns that 186's neighbourhood
is no longer a regression shorthand on its own, which is why the bundle search above is reported beside
it: this phase adds no source module, so the count must not move, and a move would have been the
regression the oracles exist for.

`git status --short` shows five modified files and no added one. **No `.svelte` file is among them** —
`src/lib/browser/workspace.svelte.ts` is a `.ts` module, and `PROGRESS.md`'s single modified line is
2d-5-2a's SHA record, which this phase did not touch.

---

## 6. Where it is thin

Marked per `CLAUDE.md` §7.3. **No item here commissions a review round** — §7.1 is the only mechanism and
it reads a diff. **No item names a correctness defect in a source file**, so none is a blocker.

1. **Nothing in this repository registers a surface — *recorded only*, inherited from 2d-5-2a.** Every
   case in the suite drives the registry directly. The copy, the freeze and the refusal are all
   established over values, and a green suite here would look identical if no component ever called any
   of it. Whether a host registers on mount, unregisters on destroy or reports its destination is
   entirely 2d-5-2b's mounted evidence.

2. **The copy is exactly as deep as today's `OpenWriteSurface` — *recorded only*.** Two levels, both
   frozen, because the union is two levels. A member added to an arm is a compile error in
   `ownedDocumentSurface`; a member that is itself an object would compile, be copied by reference and
   defeat the property §2 establishes, and nothing but a reader would catch it. Named because the
   original defect was exactly this shape one level up.

3. **The `TypeError` has no host and no test of a host — *recorded only*.** §2.4 argues the answer, and
   a case pins that it throws and changes nothing; what no case can pin is what a *component* does with
   it. A host that registers inside an `$effect` and hands over an unrepresentable surface throws inside
   that effect, and reaching that state requires defeating the compiler first.

4. **`Object.freeze`'s enforcement is strict-mode enforcement — *recorded only*.** The case asserts a
   `TypeError` because module code is strict. Under sloppy mode the same write fails silently. The
   registry is uncorrupted either way, which is the property claimed; the throw is the diagnosis, not
   the defence.

5. **A registration that survives an `open()` names a reallocated `DocumentId` — *actionable*, and not a
   defect today.** The check a later step can run: after 2d-5-2b, open a workspace with a write surface
   open and assert the registry is empty on the other side, or that the host unregistered. It is **not**
   a correctness defect in source now — nothing registers, so the registry is empty across an `open()`
   by construction and no consumer can observe the disagreement — so it does not hold this step open
   (`CLAUDE.md` §7.3). It is named as 2d-5-2b's, where hosts first make it reachable. This is the same
   reasoning 2d-5-2a's §7 item 5 used, which the review checked and accepted.

6. **Nothing enforces the read-once discipline for code added later — *recorded only*.** Findings 1 and
   3 are one rule — *never re-read a caller-supplied property after acting on the first read* — and it
   is held here by an ordering, by comments that state it, and by two accessor cases. It is not a type
   and cannot be made one; the module is the only place it is written down.

7. **Neither the fixes nor these corrections were reviewed when they were written — *recorded only*, and
   it is this phase's whole point.** §7.1 owes this phase's source changes a round, and that round is
   this phase's own review. Until it has run, everything above is a claim by the author of the change —
   including the claim that two records that were wrong are now right.
