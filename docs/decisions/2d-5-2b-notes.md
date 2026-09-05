# Phase 2d-5-2b — the `DetailPane` exhaustive assembly, and the phase's whole mounted evidence

**Status: complete.** The second of the three-way split of 2d-5-2: **(a)** the keyed registry as a
value, with no component touched — complete and closed; **(b)** the `DetailPane` exhaustive assembly,
`MatchCreator` reporting its destination upward, and the phase's whole mounted evidence — this step;
**(c)** the narrow window regression reading, still owed.

The consult that binds it is [`docs/reviews/phase-2d-5-design.md`](../reviews/phase-2d-5-design.md);
where this record and that document disagree, the consult wins. **Q1 is the ruling this step
discharges** — *"`DetailPane` should construct an exact binding object using `satisfies
Record<OpenWriteSurfaceKind, ...>` and pass required reporting props where state lives inside a
child. Registration alone is insufficient; the required binding/prop shape is the construction
check."*

**Nothing under `crates/` or `src-tauri/` changed.** No Rust file was read for its content and none
was edited; the four Rust gates were run to establish that.

**[`docs/reviews/phase-2d-5-2b.md`](../reviews/phase-2d-5-2b.md) returned `ship-with-fixes` with no
blocker and four should-fix findings, and all four are closed — §12 is the record.** One of them was
a reactivity regression this step introduced and it is fixed in source; the other three were claims
this file or a source comment made and could not support, and each was either **made true** by
writing the case it cited or **corrected**. §12 says which, one finding at a time. Sections 1, 5, 6,
9, 10 and 11 below carry correction blocks where the fixes falsified what they said; **the
superseded sentences are left in place and marked rather than deleted**, which is this project's
convention for a record that was wrong.

---

## 1. What shipped

**Two components changed, two component suites grew, and two modules had doc comments corrected.**

1. **`src/lib/components/DetailPane.svelte`** — the exact assembly, the reconciling effect, the
   teardown, the reported creator destination, and the removal of the pane's own
   `openWriteSurfaces()` producer. The restore is now handed `browser.openWriteSurfaces()`.

2. **`src/lib/components/MatchCreator.svelte`** — a **required** `reportDestination` prop, and one
   effect that reports `matchCreationView(session).chosen?.document ?? null` upward.

3. **`src/lib/components/DetailPane.test.ts`** — 13 new cases: seven per-kind registration walks,
   teardown, the creator's unknown-to-known transition, a re-opened form, an `open()` across a live
   registration, restore's surfaces, and the whole-document invalidation. **§12 makes it 15**: a late
   surface reaching the restore, and a repeat report churning nothing.

4. **`src/lib/components/MatchCreator.test.ts`** — 3 new cases over the reporter, and the mount helper
   now records every report.

5. **`src/lib/browser/writeSurfaceRegistry.ts`** and **`src/lib/browser/workspace.svelte.ts`** —
   **doc comments only, no behaviour**. Both carried sentences that 2d-5-2b falsified by existing
   (§6).

> **Correction, §12 finding 1.** Item 5 is now true of `writeSurfaceRegistry.ts` alone.
> `workspace.svelte.ts` gained behaviour when the review's finding 1 was fixed there: a reactive
> mirror of the registry's generation, a `noticeWriteSurfaces()` after every operation this state
> performs on the registry, and a wrapper around the lease so that the two operations performed
> *through it* move the mirror too. The registry module is still comments only.

### 1.1 Files

| File | What changed |
|---|---|
| `src/lib/components/DetailPane.svelte` | +404 / −71 — the assembly, the reconciler, the effect, `onDestroy`, `creatorDestination`, `startCreating`/`stopCreating`; `openWriteSurfaces()` deleted |
| `src/lib/components/DetailPane.test.ts` | +483 / −15 — 13 cases, restore fixtures, a parameterized boundary |
| `src/lib/components/MatchCreator.svelte` | +55 / −1 — one required prop, one effect, one misplaced doc comment moved onto `close` |
| `src/lib/components/MatchCreator.test.ts` | +68 — 3 cases and the reports recorder |
| `src/lib/browser/workspace.svelte.ts` | +40 / −21 — **doc comments only**, until §12 finding 1 added the reactive mirror, the lease wrapper and the three door changes |
| `src/lib/browser/writeSurfaceRegistry.ts` | +30 / −14 — **doc comments only** |

---

## 2. The frozen-surface probe, run first, and what it found

`PROGRESS.md` named one thing to check before building on the registry: 2d-5-2a-A made every stored
surface a copy the registry builds and **freezes at both levels**, no component had ever consumed one,
and whether Svelte 5's `$state` machinery is safe with a frozen object was unknown. If it were not,
that would be a source finding against `writeSurfaceRegistry.ts` rather than against the host.

**It is safe, measured over six throwaway cases and then deleted.** A frozen surface answered by
`openWriteSurfaces()` survives, unchanged and readable:

- assignment into a `$state.raw` and read back;
- assignment into a **proxied** `$state` object, then reading `kind`, `target.kind` and
  `target.document` through the proxy;
- a `$derived` over a proxied holder, before and after a `replaceTarget`;
- `$state.snapshot` of a proxied holder that contains one;
- spreading them into a `$state` array and reading them back.

The sixth case measured the refusal rather than the read: a consumer that casts away `readonly` and
writes `surface.kind` through the proxy gets **`TypeError: Cannot assign to read only property 'kind'
of object '#<Object>'`** — thrown by the frozen target, not by Svelte — and the registry is unchanged.
That is exactly what `ownedDocumentSurface`'s comment claims, now observed rather than reasoned.

**No source finding against the registry, and the shipped design does not depend on the answer
anyway.** Nothing in this step puts a frozen surface into a proxied `$state`: the pane builds its own
plain literals and hands them over, and what comes back out — `browser.openWriteSurfaces()` — is read
inside `RestorePane`'s `$derived.by` and never stored in a proxy. The probe was run because a later
step will not have that property, not because this one needed it.

---

## 3. The assembly, and exactly what each of its two checks forces

```ts
type PaneWriteSurface = OpenWriteSurface | null;

type PaneWriteSurfaces = {
  readonly [K in OpenWriteSurfaceKind]: (OpenWriteSurface & { readonly kind: K }) | null;
};

const openSurfaces: PaneWriteSurfaces = $derived({
  matchEditor: …, matchCreator: …, matchDeleter: …, matchMover: …,
  matchDuplicator: …, rawEditor: …, restore: …
} satisfies Record<OpenWriteSurfaceKind, PaneWriteSurface>);
```

**Two checks, overlapping on purpose, and they are not the same check.**

- The **`satisfies Record<OpenWriteSurfaceKind, PaneWriteSurface>`** is the construction check the
  consult names, written literally and where a reader looks for it. It forces that every member of
  the union appears as a key.
- The **annotation** forces the same thing *and* one more: `OpenWriteSurface & { kind: K }` reduces
  each entry to the arm of the shipped union that carries that kind, so an entry filed under
  `matchDeleter` cannot be a `rawEditor` surface, and the six non-creator keys cannot carry an
  `unknown` target at all. Only `matchCreator` can.

**The annotation is derived from `OpenWriteSurface` rather than written out**, which is deliberate:
spelling the seven arms again would be a second definition of the union that can drift from the
first, and this project has shipped that shape.

### 3.1 The demonstration, which is this step's central evidence

Deleting the `matchMover` key and running `npm run check`, on the tree this step leaves:

```
ERROR "src/lib/components/DetailPane.svelte" 571:9 "Property 'matchMover' is missing in type
'{ matchEditor: …; matchCreator: …; matchDeleter: …; matchDuplicator: …; rawEditor: …;…'
but required in type 'PaneWriteSurfaces'."
ERROR "src/lib/components/DetailPane.svelte" 610:5 "Type '{ … }' does not satisfy the expected type
'Record<OpenWriteSurfaceKind, PaneWriteSurface>'.
  Property 'matchMover' is missing …"
COMPLETED 438 FILES 2 ERRORS 0 WARNINGS 1 FILES_WITH_PROBLEMS
```

**Both checks fired independently**, which is why the record above says either one alone would do it.
The key was restored and `npm run check` came back `438 FILES 0 ERRORS 0 WARNINGS`. The two line
numbers are a snapshot of the demonstration and not maintained pointers — they were read off the tree
with the key **removed**, which is seven lines shorter than the one this step leaves. On the shipped
tree the annotation on `openSurfaces` is at `:571` and the `satisfies` closing the literal is at
`:617`.

### 3.2 What the assembly does **not** force, said in the same breath

It does not force that the value filed under a key is **true**. A key wired to the wrong session, or
to a document identity read off the wrong side of a session, type-checks perfectly — every one of the
seven entries would compile with `deletingMatch.projection.id` in it. The seven per-kind cases in
`DetailPane.test.ts` open each surface from the screen and read the registry back; that is the only
thing that catches it.

It does not force that a component written later is **classified** as a write surface. The consult
says so itself, and it is the limitation `competingSurfaceFor` has always had: an empty answer claims
there are no open surfaces rather than that nobody registered.

---

## 4. The reconciler, the transition, and the three differences that can exist

The effect is one call — `reconcileWriteSurfaces(openSurfaces)` — and the reconciler asks the registry
only for what actually differs: a kind opened, a kind closed, or a kind whose file moved.

**Why not a cleanup returned from the effect.** An effect's cleanup runs before every re-run, not only
at teardown, so returning the disposal would return every lease this pane holds and take them out
again on every keystroke in the raw editor, which replaces `openSurfaces` whole. Every registration moves the registry's generation, and consult Q5 makes that generation a
coordinator's guard against installing over a surface — a counter that moved for changes nobody made
would make that guard refuse for nothing. Teardown is `onDestroy`, which runs once.

**Why not a call in each opener and each closer.** There are seven openers and more than seven closers:
a `close` prop on six components, `invalidateEverySurface`, and the form's own re-seed. A rule spread
over that many call sites is a rule one of them can omit, and no type would notice.

**`replaceTarget`'s answer is read**, and `staleLease` re-registers rather than believing a report that
did not land. Nothing in this window can produce a `staleLease` today — this pane is the only
registrant and it holds one lease per kind — so that arm is written for the shape rather than for a
reachable case. It is the shape this project has shipped as a defect twice in one phase.

**Going back to naming no file is a re-key**, because `replaceTarget` takes the document arm only. The
registry's own comment argues for that signature, and a form whose destination is taken back therefore
unregisters and registers again: the generation moves twice and the entry goes to the end of the
reader's order. Neither changes any answer either predicate gives.

### 4.1 The transition passed, and why it is a no-op

All seven register `tellNobodyYet`, a single named no-op.

**Nothing invokes a stored transition anywhere in this repository.** `transitionFor` is the only reader
of one and it has no caller; 2d-5-4 routes an admitted observation to the surface a reload would
strand, and 2d-5-5 generalizes the six existing conflict registrations. Writing seven different bodies
now would be seven claims about a protocol that does not exist, and any body that *did* something would
be inventing it.

**What it will do the moment it stops being inert is stated in the source rather than left to be
discovered.** Under Q5 the coordinator installs no projection when a surface may target the document
and hands the observation to that surface instead — so with this body the draft survives and the person
is never told the file moved. That is the conservative half of the rule and the wrong half of the
answer. Replacing it is 2d-5-4's and 2d-5-5's work; it is listed in §8.

---

## 5. `MatchCreator` reporting upward

The prop is **required** — the consult's *"pass required reporting props where state lives inside a
child"* — so a host that mounts the form must supply one. `DetailPane` is the only host.

**The report is over the model's answer, never over the control that was pressed.** The effect reads
`matchCreationView(session).chosen?.document ?? null`, so every transition that moves the destination
is covered by one call site: `onDestination`, a re-seed after a committed create, an undo or redo that
restores a step with a different file, and a reload that replaces the session whole. Reporting from
`onDestination` alone would have been a second rule about which transitions move the destination, and
it would have been wrong for four of them — one of the three new `MatchCreator.test.ts` cases drives
exactly that: with a held selection, `startMatchCreation` defaults the destination and the **first**
report names a file nobody clicked.

> **Correction, §12 finding 4.** *"The model's answer is what is reported"* understates what that
> answer is, and the understatement is in the unsafe direction. `view.chosen` is
> `chosenDestination(session)` (`matchCreation.ts:716-722`), which looks `session.chosen` up **in the
> destinations this session holds** and answers `null` when it is not among them. So a form holding a
> **stale** destination — an identity the session's own destination list no longer offers — reports
> *names no file*, and the registry describes it as `unknown`. The directions are the pair this
> section already names for the flush gap, reached by another route: `competingSurfaceFor` treats an
> unnamed creator as competing with **nothing**, so a restore of the file that form would write
> proceeds (under-refusal), while `targetingSurfaceFor` attributes it to **every** creator-eligible
> file (over-refusal). What is reported is *the destination this session still offers*, never *the
> file the person last clicked*. `MatchCreator.svelte`'s own effect comment now says this too.

**What the required prop forces and what it does not.** It forces that every host supplies a reporter.
It forces nothing about the child calling it, calling it with the destination the model holds, or
calling it again when that changes — the consult says a type cannot, and the three mounted cases are
what establish those.

**The report is late by one effect flush, and both consumers refuse conservatively across that gap.**
Between the person choosing a file and the effect running, the registry still describes the form as
naming none: `targetingSurfaceFor` then attributes it to every creator-eligible file (over-refusing)
and `competingSurfaceFor` lets a restore of any file proceed (under-refusing). Nothing reads either
answer in production at 2d-5-2b, and the pane's `busy` rule keeps a restore from being open beside the
form at all.

> **Correction, 2d-5-2b-A finding 4 — "nothing reads either answer in production" is wider than the
> code.** `competingSurfaceFor` **is** read in production, and on every open restore:
> `RestorePane.svelte`'s `current` builds a context from `surfaces()` and `restoreRefusal` asks it
> (`restore.ts:1993`), as does `permitHolds` at the send (`restore.ts:2581`). What has no production
> caller is `targetingSurfaceFor` alone. **The clause that follows is the true one and it was already
> there**: what makes the gap inert is the pane's `busy` rule, which keeps a restore from being open
> beside this form at all — a fact about `DetailPane.svelte` rather than a guarantee of the model's.
> `MatchCreator.svelte`'s effect comment is corrected to say the same, since that is where a reader of
> the effect looks. This is the fifth instance in this chain of a sentence whose scope is wider than
> the code, written inside the block that fixed the previous one.

**The pane clears `creatorDestination` on both edges.** `startCreating` and `stopCreating` are named
functions rather than assignments in the markup, so the flag and the destination cannot be moved apart;
without the clear on open, a file reported by one form would describe the next one until the child's
effect flushed. `invalidateEverySurface` calls `stopCreating()` for the same reason.

**The report repeats**, because the effect re-runs on every session transition and reports the same
value again. The host absorbs it: `creatorDestination` is `$state.raw` and an equal assignment
notifies nothing, so the reconciler is not entered. Nothing in TypeScript forces a host to absorb it;
the third `MatchCreator.test.ts` case records the repeat as a fact so a later host is not surprised by
it.

> **Correction, §12 finding 3 — a claim made true rather than corrected.** As shipped, this
> paragraph and `MatchCreator.test.ts`'s own comment both said `DetailPane.test.ts` is what shows the
> registry is not churned by the repeat. **No case there drove a repeat report**: nothing typed into
> the form, and the only generation assertions were in three other cases. The claim was made true by
> writing the case — *"leaves the registry alone when the form reports the same file again"* — which
> opens the form, chooses `match/a.yml`, types into the trigger box and asserts that
> `writeSurfaceGeneration()` has not moved and the entry is unchanged. The generation is the
> assertion because the live set alone would not be one: a re-registration leaves an identical
> surface behind it.

---

## 6. The routing, and the sentences 2d-5-2b falsified by existing

`RestorePane`'s `surfaces` prop is now `() => browser.openWriteSurfaces()`, and the pane's own
`openWriteSurfaces()` producer is **deleted**. `restoreDocument`'s `surfaces` argument travels through
`RestorePane`, which reads that prop once into the value it checks the confirmation against and sends
*that* list — so the gate and the write are one reading, and both are the registry's answer. `2d-5-2a-notes.md` §7 item 5 — *"two answers to one question"* — is discharged: the
pane has one producer of an `OpenWriteSurface` and it is the assembly.

**What happened to the five dead literals.** `PROGRESS.md` records 2d-5-1-C's measurement that five of
the old producer's six entries could not execute at all, in production or in any test, because its one
caller sat inside the `{:else if restoring !== null}` arm and `busy` had already made the other five
null. That shape is gone: the assembly is not conditioned on which arm is being drawn, so all seven
entries are live and each is driven by its own case. **`busy` still means at most one is non-null at a
time**, so the registry holds at most one entry from this pane — which is why the registry's documented
array order decides nothing here.

**One behavioural difference, and it is named rather than glossed.** The pane's array was built at the
instant it was asked; the registry's answer is in step with the last effect flush. A surface opened in
the same synchronous block as the question is therefore not in it yet. That is the direction the
pre-send refusal was already an affordance about — a surface can open after the preview — and
`confirmRestore` re-asks at the write, which is where the guarantee lives.

> **Correction, §12 finding 1.** The last clause was false, and the difference was much larger than
> *"in step with the last effect flush"*. `confirmRestore(session, context)` reads
> `context.surfaces` — the argument it is handed (`restore.ts:1993`) — and never asks the registry,
> so it re-checks a reading rather than taking a new one. And as shipped there was no reading to
> re-check: the registry is a plain `Map`, `RestorePane`'s `$derived.by` therefore had **no
> dependency any registration moved**, and the measurement below shows it computed once, before the
> pane's registration effect, over the **empty** set and never again. What that sentence should have
> said is what is now true: the answer is reactive because `BrowserState.openWriteSurfaces` reads a
> signal mirroring the registry's generation, `confirmRestore` re-checks the surfaces it is handed —
> which is that same reading, taken when the send is pressed — and what actually stands between a
> restore and a file another surface is writing is the transaction's own locked read and revision
> check, never this list.

**Two files were edited for their comments alone**, because 2d-5-2b made their sentences false:

- `writeSurfaceRegistry.ts` said *"No component registers anything yet, and no transition is ever
  called"* — the first half is now false and the second is still true, so they were separated. Its
  `UnregisterWriteSurface` header said the disposal path 2d-5-2b writes *"is one `return` with nothing
  to forget"*, which the implementation falsified: the pane holds up to seven leases and its teardown
  is a loop. The header now says which host does what and why.
- `workspace.svelte.ts` said *"Nothing registers anything yet"*, *"It is not wired to
  `restoreDocument`"* and *"It is not what `DetailPane.svelte` passes to a restore today"*. All three
  are now false, and the third had a true replacement that is narrower than it looks: the parameter
  stays, and what changed is who supplies the argument.

---

## 7. The `open()` decision, re-taken with evidence

`2d-5-2a-notes.md` §3.8 decided that `open()` does **not** clear the registry, and its 2d-5-2a-A
correction recorded the cost — a registration that survives an `open()` names a `DocumentId` that now
denotes a **different file**, because the load below reallocates identities — as *"inert at 2d-5-2a
… and live at 2d-5-2b, where hosts register."*

**The decision stands, and three things are now measured rather than expected.**

1. **A registration really does survive an `open()` when its host does.** Driven in
   `DetailPane.test.ts`: the editor is opened, `open(null)` is awaited, and the registry still answers
   the same surface. The cost is real, not hypothetical.
2. **No production `open()` can run while a surface is registered.** `open()` has exactly two callers
   in this repository, both in `AppShell.svelte`: one in `onMount`, before the pane exists, and one on
   a *Retry* control drawn only in the `failed` arm, where `DetailPane` is not mounted at all.
3. **The guard those callers sit behind disposes anyway.** `open()` sets `status` to `'loading'`
   **synchronously**, before its first await — asserted in the same case, because that is the half that
   is not obvious from reading the markup — and `AppShell.svelte` draws the three panes only in its
   `{:else}` arm. Measured in a throwaway probe that reproduced that guard shape around the real pane:
   the registry answered the surface right after the call, and `[]` after one flush, with the
   generation at 2 (one register, one unregister). The probe is deleted; the recipe is a component of
   `{#if browser.status === 'loading'}…{:else}<DetailPane {browser} />{/if}` mounted over the same
   scripted state this suite builds.

**Why keeping it is the safe direction, stated as the comparison rather than as an assertion.** Not
clearing costs a false refusal over an unrelated file, because both consumers refuse rather than
permit — a write stays safe. Clearing would cost the opposite: a host that *did* survive would go on
holding an open surface the registry no longer reports, and *"no surface is open"* is the answer that
permits a silent reload.

**What that leaves open**, and it is the honest residue: the window between the synchronous
`status = 'loading'` and the flush, in which the registry still answers surfaces over identities the
load is about to reallocate. Nothing reads it there today. **2d-5-4's discarded-history recovery is the
third caller of `open()`**, and consult Q3 already forbids it to re-open while any surface is open, so
the obligation lands in the step that adds it rather than here.

---

## 8. The mount-path throw, and how far the argument goes

`registerWriteSurface` throws a `TypeError` on a pairing `OpenWriteSurface` cannot represent, and
2d-5-2a-B documented it with an `@throws` precisely because **a throw on a mount path is a blank pane**
— which this project has shipped once (R32). Until this step the hazard was unfalsifiable.

**No production path in this pane can reach it, by construction.** Every surface handed to the registry
comes from `openSurfaces`, whose entries are object literals written in one file, checked against the
shipped union by `PaneWriteSurfaces`, and built with **no cast and no assertion**. The registry's
refusal fires on what a *read* answers rather than on what was declared, and neither read can run
anything here: the seven sources are `$state.raw` or a boolean, so no reactive proxy stands between the
registry and a plain data property, and none of these objects has an accessor. `replaceTarget` cannot
throw at all — it builds only the document arm.

**What that says and what it does not.** It says no production path in this pane reaches the throw. It
does not say the throw is unreachable: a caller that takes a kind and a target apart and reconciles
them with a cast reaches it, which is the caller the registry's own `@throws` describes. And it rests
on the compiler being right about these literals, which is a soundness assumption this project makes
everywhere else too.

---

## 9. The evidence, case by case

**`DetailPane.test.ts`, 15 new cases** — 13 as this step shipped, and the two §12 added.

| Case | What only a mount can establish |
|---|---|
| seven × *registers and unregisters its `<kind>`* | the entry filed under each key is true of the surface that key names, the host registers on open, and the host unregisters on close. The walks are a `Record<OpenWriteSurfaceKind, SurfaceWalk>`, so an eighth kind is a compile error in the file that proves the composition too |
| *returns every lease when the pane is unmounted* | disposal, which no type forces. The pane is torn down with a surface still **open**, and the generation is asserted at exactly 2 |
| *moves the new-snippet form from no file to its chosen one in place* | the reporter is invoked by the child, and the move goes through `replaceTarget`: the generation moves by exactly **one**, which an unregister-and-register would have moved by two |
| *forgets a reported destination when the form is closed and opened again* | the clear on both edges; without it the second form registers over the first form's file |
| *leaves a registration standing across an `open()`* | §7 item 1, plus the synchronous `status = 'loading'` |
| *gives the restore its surfaces from the registry, itself included* | restore's behaviour is unchanged: the list holds the restore's own entry over the file it opened on, and none of the six competing-surface sentences is drawn |
| *runs the whole-document invalidation when a restore commits* | §9.1 |
| *shows the restore a surface that opened after its derived had run* | §12 finding 1: a surface registered by a **second host** while a restore is open reaches the child — the refusal sentence appears and *Prepare* is disabled — and closing it reaches the child too, which is what puts the lease's own two operations under the mirror |
| *leaves the registry alone when the form reports the same file again* | §12 finding 3: the host absorbs the creator's repeat report, so the generation does not move |
| *shows the restore a surface that was re-targeted onto its file* | 2d-5-2b-A finding 2: the lease's `replaceTarget` moves the mirror. A creator registered by a second host naming **no file** draws no refusal; pointing it at the restore's own file through the lease draws one, and only a mirror that moved can put it on screen |

> **Correction, §12 finding 2 — a claim made true rather than corrected.** As shipped, that case
> asserted `registered(pane.state)` — the registry, read directly — plus the absence of the six
> sentences, and **neither observes the list the child was given**: `competingSurfaceFor` skips
> `restore` entries, so an empty list and a list holding only the restore's own entry draw
> identically. The claim in this table was therefore not established by it. Worse, it was **false**:
> the case now records what the door answers while the restore is open, and on the code as shipped
> the last answer is `[]`, not `[{restore}]` — measured by making the assertion and watching it fail
> before finding 1's fix and pass after it. The claim was made true by recording the answers
> `browser.openWriteSurfaces()` gives — that closure is the only call to the door in any component,
> so its answer *is* what `RestorePane`'s derived was handed — and asserting the **last** of them.
> The first answer is legitimately `[]`, for the ordering reason §12.1 measures.

> **Correction, 2d-5-2b-A finding 1 — what "the generation" means in three rows above.** *returns
> every lease when the pane is unmounted*, *moves the new-snippet form …* and *leaves the registry
> alone …* all assert `writeSurfaceGeneration()`, and that door now answers the **registry's own**
> number rather than the reactive mirror. Every claim those rows make is unchanged and is now made
> against a stronger oracle — the number and the set beside it come from the same place. What they
> no longer establish is anything about the mirror, which is why the row added below them exists.

**`MatchCreator.test.ts`, 3 new cases**: reports `null` on mount then the chosen file; reports the
model's **default** with no control pressed; reports again when a transition leaves the destination
where it was.

### 9.1 The `invalidateEverySurface` gap, and the exact shape of what closes it

`PROGRESS.md` records that `invalidateEverySurface` is reached by **no test at all**, repository-wide,
measured rather than assumed at 2d-5-1-B. The new case drives a committed restore through the mounted
pane — catalogue, batch, entry, prepare, confirm — and asserts the exact bytes that reached the
boundary.

**Reaching the committed sentence is what proves the body ran.** `openWholeDocumentSave` is the only
way to learn a whole-document outcome and it discharges the invalidation on the way, so a screen that
says the file was written is a screen whose host's body was called.

**What the case does not establish, and this is the part a later reader must not over-read.** It does
not show the body *closes* anything: `busy` keeps every other surface shut while a restore is open, so
there is nothing for it to close, and 2d-5-1-B measured that deleting a line from the body breaks no
test in this repository. The gap that closes is *"never executed"*; the gap that remains is *"its
effect is unobservable from this pane"*, and it will stay so for as long as the seven surfaces are
mutually exclusive.

---

## 10. The gates, measured

Each run on its own. **The baseline was `1320 / 438 / 2235 / 186`.**

| Gate | Result | Move |
|---|---|---|
| `cargo test --workspace` | **1320** passed | **0** — no Rust file changed |
| `npm run check` | **438** files, **0** errors, **0** warnings | **0** — no file added or removed |
| `npm test` | **2251** passed, 59 files | **+16**: `DetailPane.test.ts` +13, `MatchCreator.test.ts` +3. `scripts/lint/ipc-detail.test.ts` did not move, which is right — its cases are generated from `scannableFiles()` and no file was added under the scanned roots |
| `npm run build` | **186** modules | **0** — no new reachable `.ts` module and no new component. Every file this step touched was already in the graph |
| `cargo clippy --workspace --all-targets -- -D warnings` | clean | |
| `cargo fmt --check` | clean | |
| `cargo tree -p espansoconfig-core \| rg tauri` | no match | |

**Both bundle oracles read, and both lines reported**, because the second exists to prove the search
can match at all:

```
rg -c '\$\$payload|head_payload|push_element' dist/assets/index-*.js   → no match (exit 1)
rg -c 'window\.__svelte|svelte-trusted-html' dist/assets/index-*.js    → 2
```

**The build figure needs its per-file derivation said explicitly, because `0` is the answer that looks
like a missing measurement.** The ladder in `CLAUDE.md` §4 is one module per new reachable `.ts`
module and two per new styled `.svelte` component. This step added neither: `writeSurfaceRegistry.ts`
became reachable at 2d-5-2a and is already counted, `DetailPane.svelte` and `MatchCreator.svelte` were
already in the graph with their `<style>` blocks, and everything else changed is a test file, which
the production build does not see. `0` is the derivation's answer and not a skipped measurement.

### 10.1 Re-run after §12's fixes

Each run on its own, from **this step's own figures** as the baseline — `1320 / 438 / 2251 / 186`.

| Gate | Result | Move |
|---|---|---|
| `cargo test --workspace` | **1320** passed | **0** — no Rust file changed; §12 touched `src/` only |
| `npm run check` | **438** files, **0** errors, **0** warnings | **0** — no file added or removed |
| `npm test` | **2253** passed, 59 files | **+2**, both in `DetailPane.test.ts`: *shows the restore a surface that opened after its derived had run* and *leaves the registry alone when the form reports the same file again*. No other file moved — `MatchCreator.test.ts` gained a corrected comment and no case, `workspace.svelte.ts`'s change is behind existing cases, and `scripts/lint/ipc-detail.test.ts` generates its cases from `scannableFiles()`, which gained no file |
| `npm run build` | **186** modules | **0** — no new module and no new component. `workspace.svelte.ts` was already in the graph, and everything else §12 touched is a test file or a comment |
| `cargo clippy --workspace --all-targets -- -D warnings` | clean | |
| `cargo fmt --check` | clean | |
| `cargo tree -p espansoconfig-core \| rg tauri` | no match | |

Both bundle oracles read, and both lines reported:

```
rg -c '\$\$payload|head_payload|push_element' dist/assets/index-*.js   → no match (exit 1)
rg -c 'window\.__svelte|svelte-trusted-html' dist/assets/index-*.js    → 2
```

---

## 11. Where it is thin

Marked per `CLAUDE.md` §7.3. **No item here commissions a review round** — §7.1 is the only mechanism
and it reads a diff. **No item names a correctness defect in a source file**, so none is a blocker.

1. **Every surface registers a no-op transition, and 2d-5-4 must replace all seven —
   *actionable*.** `tellNobodyYet` in `DetailPane.svelte` is the transition seven registrations carry.
   Nothing invokes a stored transition today, so it is inert; the moment 2d-5-4 gives `transitionFor` a
   caller it becomes an observation delivered to nobody, which under Q5 means the draft survives and the
   person is never told the file moved. It names a file and a defect-in-waiting, so it is actionable; it
   is **not** a correctness defect in source today, because no caller exists, so it holds no step open.

2. **The registry holds at most one entry from this pane, so the multi-surface behaviour of both
   predicates is exercised by nothing on a screen — *recorded only*.** `busy` makes the seven mutually
   exclusive, so `competingSurfaceFor`'s and `targetingSurfaceFor`'s array-order rules, their
   first-wins guards, and the registry's *displacing registration keeps its position* property are all
   driven by model tests over hand-built arrays and by no mounted case at all. A window that ever drew
   two write surfaces at once would be the first thing to exercise them.

   > **Correction, §12 finding 1 — partly closed.** One competing-surface arm is now driven on a
   > screen: *shows the restore a surface that opened after its derived had run* registers a
   > `matchEditor` over the restore's own file **the way a second host would**, and the pane draws
   > `browser.restore.refused.matchEditorOpen` and disables *Prepare*. What stays true is the rest of
   > the item — the array-order rules, the first-wins guards and the displacing-registration property
   > are still model-only, because this pane still draws at most one surface at a time and the second
   > entry in that case comes from a test rather than from a component.

3. **`staleLease` is unreachable from this pane, and its arm is untested — *recorded only*.**
   `reconcileWriteSurfaces` re-registers on it, which is the right answer, but this pane is the only
   registrant in the application and holds one lease per kind, so nothing can displace it. The arm is
   written for the shape rather than for a case, and no test drives it.

4. **The reporter's flush gap is reasoned about and not measured — *recorded only*.** §5 says that
   between a destination being chosen and the child's effect running, the registry still says
   `unknown`, and that both consumers refuse conservatively across it. No case drives a read of the
   registry *inside* that gap; the seven registration cases all `flushSync()` first. What makes it
   inert is `busy`, which is a fact about this pane rather than a guarantee of the model's.

   > **Note, §12.1.** A *neighbouring* ordering is now measured and this item is not it. What §12.1
   > establishes is that the child's `$derived.by` runs before the host's registration effect within
   > one flush; what stays unmeasured here is a read of the registry taken between the creator's
   > report and the host's effect. Both are consequences of an effect running after the transition
   > that caused it, and neither measures the other.

5. **The `open()` measurement of §7 item 3 rests on a probe that no longer exists — *actionable*.**
   The claim that `AppShell.svelte`'s guard unmounts the pane and returns its leases was measured, but
   the component that measured it was a throwaway that reproduced the guard's shape rather than
   `AppShell` itself. What survives in the suite is the synchronous `status = 'loading'` assertion and
   a reading of `AppShell.svelte`'s markup. A later step that mounts `AppShell` — 2d-5-7 is the one
   that touches it — can make the whole chain a mounted fact. It names a check that can be run in a
   file that exists, so it is actionable; it is not a defect, so it holds nothing open.

6. **`invalidateEverySurface`'s effect is still unobservable — *recorded only*.** §9.1 states the
   split: the body now runs in a test, and what it closes cannot be seen from this pane while the seven
   surfaces are mutually exclusive. 2d-5-1-B's measurement — that deleting a line from it breaks no
   test in this repository — is not superseded by this step and should not be read as if it were.

7. **No window has been opened on any of this — *recorded only*.** 2d-5-2c is the narrow window
   regression reading and it is owed for a pane whose seven surfaces now all run an effect on open and
   a teardown on close. A mounted test proves a handler fires; it does not prove a window draws, and
   the reading may not claim real watcher delivery.

8. **`MatchCreator.svelte` gained a required prop, and only one host exists to prove it —
   *recorded only*.** The compiler forces every host to supply a reporter, which is the whole point of
   the shape; what no test can establish is that a *second* host, written later, wires it to something
   that reaches the registry rather than to a no-op of its own.

**Three items §12 opened**, marked the same way.

9. **The mirror is kept by hand, and nothing in TypeScript keeps it — *actionable*.**
   `BrowserState`'s reactive `surfaceGeneration` is brought into step by `noticeWriteSurfaces()`,
   called after each of the three operations this state performs on the registry: the registration,
   the lease's unregister and the lease's `replaceTarget`. A fourth method added later that touches
   `writeSurfaces` without that call would leave every consumer's dependency behind the live set, with
   nothing failing — the same shape as the defect §12 finding 1 closed, one layer down. It names a
   check that can be run in a file that exists — `rg -n 'writeSurfaces\.' src/lib/browser/workspace.svelte.ts`
   and read each hit — so it is actionable; today all three mirror, so it names no defect and holds
   nothing open.

   > **Correction, 2d-5-2b-A finding 1 — the item stands, and what an unmirrored path costs is
   > narrower than it says.** The mirror is still kept by hand and TypeScript still forces nothing, so
   > the item is not closed. What changed is the consequence: with `writeSurfaceGeneration()` now
   > answering `writeSurfaces.generation()`, a fourth method that moved the registry without mirroring
   > would leave **both doors truthful and neither reactive** — the *invalidation* is lost, not the
   > *value*. Before the fix it lost the value too, on the door a coordinator captures across an await.
   > The suggested check answers differently now, so it is re-derived here rather than restated:
   > `rg -n 'writeSurfaces\.' src/lib/browser/workspace.svelte.ts` gives **five** lines — the copy
   > inside `noticeWriteSurfaces()`, the registration, the read in `openWriteSurfaces()`, one mention
   > inside `writeSurfaceGeneration()`'s own comment, and the read in `writeSurfaceGeneration()`. That
   > is **one mutation, three reads and one comment**, and it is the mutation the check is about; the
   > two other mutations still reach the registry through the lease, which this `rg` never shows.

10. **The lease `BrowserState` hands out is not the registry's own object — *recorded only*.** It is a
    wrapper that calls through and then mirrors, so a caller comparing the value it was handed against
    one the registry minted would find two different functions. Nothing compares them: the registry
    recognises a lease by the serial it captured itself. What the wrapper cannot change is any answer —
    the unregister stays idempotent and inert once displaced, and `replaceTarget`'s `replaced` or
    `staleLease` is passed back unchanged.

    > **Note, 2d-5-2b-A finding 2.** The pass-back half is no longer only reasoned: *shows the
    > restore a surface that was re-targeted onto its file* asserts the wrapper answers `'replaced'`
    > on a mounted screen. The `staleLease` arm is still driven by nothing here — item 3 above is
    > where that is recorded — and the identity claim is unchanged, because no caller compares leases.

11. **The restore's first reading of the live set is always one step behind — *recorded only*.**
    §12.1 measures why: the child's derived computes before the host's registration effect, so its
    first answer describes the registry as it was before this pane registered anything. It is corrected
    within the same flush, and nothing reads the value in between; what would make it matter is a
    consumer that captured the first answer rather than deriving from it.

---

## 12. The review's four fixes

[`docs/reviews/phase-2d-5-2b.md`](../reviews/phase-2d-5-2b.md) — `ship-with-fixes`, **0 blockers**,
four should-fix findings. All four are closed. Two of the three claims were **made true** rather than
corrected, which is the direction this project's conventions ask for; the fourth was an
understatement in this record and is corrected in §5.

### 12.1 The ordering, measured before anything was chosen

The reviewer left the flush ordering unmeasured and said so, and the fix depended on it: a dependency
on the pane's *own* assembly would re-run the child's derived **before** the reconciler had touched
the registry, trading a stale answer for a differently stale one. So it was measured first, in a
throwaway case appended to `DetailPane.test.ts`, wrapping `BrowserState.registerWriteSurface` and
`BrowserState.openWriteSurfaces` in recorders and opening the restore.

**What was observed, on the tree as this step shipped it** — one `flushSync()` after the click that
opens the restore:

```
--- about to click restore ---
--- clicked, before flushSync ---
ask:[]
register:restore
--- after flushSync ---
```

**The child's `$derived.by` runs before the host's registration `$effect`, and on the shipped tree it
never ran again.** Two facts, and the second is the sharper one. The derived computed once, over a
registry this pane had not yet registered with, and answered the **empty** set; nothing afterwards
invalidated it, so `current.context.surfaces` stayed `[]` for the life of that restore — which is why
finding 2's claim was not merely unobserved but false, and why finding 1's under-refusal was total
rather than a narrow window.

**The same probe on the fixed tree**, with a foreign registration added after the flush to stand for a
second host:

```
--- about to click restore ---
--- clicked, before flushSync ---
ask:[]
register:restore
ask:[restore]
--- after flushSync ---
register:matchEditor
--- foreign registration made, before flushSync ---
ask:[restore,matchEditor]
--- after flushSync ---
```

The ordering is unchanged — the fix does not reorder anything — and what changed is that the
registration now invalidates the derived, so a second computation follows it inside the same flush.
**The probe is deleted**; the recipe is the two wrappers above and one `flushSync()` per step, and the
two kept cases in `DetailPane.test.ts` are what a later reader runs instead.

**Why the mirror is at the door rather than in the pane.** A counter owned by `DetailPane` and bumped
inside its reconciler would have been correct for this pane and wrong as a rule: it moves only for
registrations *this component* makes, so a second host's surface would be invisible to the restore
exactly as before. The dependency belongs where every registrant already passes, which is
`BrowserState`, and the new case proves it by registering the way a second host would.

### 12.2 Finding 1 — the reactivity regression, fixed in source

**What was wrong.** `DetailPane.svelte` passes the restore `surfaces={() => browser.openWriteSurfaces()}`,
and that reads a plain `Map` in a module whose header says nothing in it is reactive. The producer
this step deleted closed over six `$state.raw` sources and therefore invalidated
`RestorePane.svelte`'s `$derived.by`; its replacement invalidated nothing. Direction: **under-refusal**
— a restore proceeding past a surface writing the same file — inert only because `busy` makes this
pane's seven mutually exclusive, which is a fact about the pane and not a guarantee of the model's.

**What changed**, all in `src/lib/browser/workspace.svelte.ts` except the comment:

1. `surfaceGeneration`, a `$state` number **mirroring the registry's own generation**. It is a mirror
   and not a second count, so the two cannot drift: nothing here decides *when* the set changed, it
   copies the registry's answer to that question. Assigning an unchanged number notifies nothing, so
   an already-inert unregister and a `staleLease` report cost no invalidation.
2. `noticeWriteSurfaces()` after every operation this state performs on the registry, and
   `mirroringLease()` around the lease it hands out — because two of the three operations that can
   move the live set are performed **through the lease**, and a mirror updated only in
   `registerWriteSurface` would go stale the moment a surface closed or the form reported its file.
   `replaceTarget`'s answer travels back unchanged.
3. `openWriteSurfaces()` reads the mirror and discards the value, which is the whole point of the
   line: the read is what subscribes a caller's `$derived` or `$effect`. `writeSurfaceGeneration()`
   now answers the mirror too, so the two doors cannot report different numbers — and that is what
   puts two **existing** cases onto the mirror, since *returns every lease when the pane is unmounted*
   asserts the generation at 2 after an unregister and *moves the new-snippet form …* asserts it moves
   by exactly one over a `replaceTarget`. **Measured, not inferred**: with both `noticeWriteSurfaces()`
   calls inside `mirroringLease` commented out, those two cases fail along with the new one, and they
   pass again when the calls come back.

   > **Correction, 2d-5-2b-A finding 1 — item 3's second half no longer describes the code.**
   > `writeSurfaceGeneration()` no longer answers the mirror. It now does what `openWriteSurfaces()`
   > does: `void surfaceGeneration; return writeSurfaces.generation();` — the read is the dependency
   > and the **registry's own number** is the answer. Returning the mirror made the door *derivative*,
   > and the direction of that was unsafe: a later method moving the registry without calling
   > `noticeWriteSurfaces()` would have made this door report "nothing changed" while
   > `openWriteSurfaces()` answered the new set in the same block, and the Q5 guard 2d-5-4 captures is
   > exactly the caller that would have believed it.
   >
   > **What that costs is stated because it is the part the original sentence got right.** Answering
   > the registry means the two doors describe the same state *by construction*, but it also means
   > **no generation assertion can observe the mirror at all** — the two "existing cases put onto the
   > mirror" above are now registry assertions, which is a stronger oracle for what they claim and no
   > oracle whatever for the mirror. That is 2d-5-2b-A finding 2, and §13 is what answers it.
4. The false sentence at `DetailPane.svelte`'s restore block — *"and `confirmRestore` re-asks at the
   write"* — is replaced. `confirmRestore` re-checks the surfaces it is **handed**, which is the same
   one reading taken when the send is pressed; that the reading is current is the mirror's doing, not
   `confirmRestore`'s. What stands between a restore and a file another surface is writing is the
   transaction's own locked read and revision check.
5. Two module headers that had become false were corrected in the same breath as what they claim:
   `writeSurfaceRegistry.ts`'s *"Nothing here is reactive, deliberately"* (still true of the module,
   and now says where the mirror lives instead), and `workspace.svelte.ts`'s *"Nothing renders it"*
   (false since a component started deriving the restore's refusal from it).

**What the fix does not do**, said where it is claimed. It does not make the answer *complete* — a
component that never registers is still invisible, which is `competingSurfaceFor`'s standing
limitation — and it does not close the gap **inside** a synchronous block: a surface a host has opened
but whose effect has not run is not registered, so it is not in the answer. Reactivity closes the gap
between two flushes and no other.

**The evidence.** *shows the restore a surface that opened after its derived had run*, in
`DetailPane.test.ts`: with a candidate prepared, a `matchEditor` over the restore's own file is
registered the way a second host would, and the refusal sentence appears while *Prepare* goes
disabled; the lease is then called and both go back. Removing the mirror read from
`openWriteSurfaces()` fails that case and finding 2's, which is how the case was checked for
vacuity.

### 12.3 Finding 2 — the criterion-4 case, made true

`registered(pane.state)` reads the registry rather than the list the child was given, and the six
absent sentences cannot tell `[]` from `[{restore}]` because `competingSurfaceFor` skips `restore`
entries. **Made true rather than corrected**: `watchSurfaceAnswers` records every answer the door
gives, `DetailPane.svelte`'s closure is the only call to that door in any component, and the case
asserts the **last** answer holds the restore's own entry over the file it opened on. §9's table
carries the correction block, including the part that matters most — the claim was false, not merely
unestablished, and the assertion was watched failing before finding 1's fix and passing after it.

**What that observation is not.** It observes the value the pane's prop answered, not what
`RestorePane.svelte` did with it. The case above is what observes the child's *use* of the list, and
the two are deliberately separate cases.

### 12.4 Finding 3 — the cited case, written

`MatchCreator.test.ts`'s *"reports again when a transition leaves the destination where it was"* said
`DetailPane.test.ts` shows the registry is not churned by the repeat. No case there drove a repeat
report. **Made true rather than corrected**: *leaves the registry alone when the form reports the same
file again* opens the form, chooses `match/a.yml`, types into the trigger box and asserts the
generation has not moved and the entry is unchanged. The comment now names that case, and says the
review is why it exists. §5 carries the same correction.

### 12.5 Finding 4 — the understatement, corrected

*"The model's answer is what is reported"* is true and too weak. `chosenDestination` answers `null`
when `session.chosen` names an identity the session's destinations no longer hold, so a form holding a
**stale** destination reports *names no file*. §5's correction block states it with its direction —
under-refusal on `competingSurfaceFor`'s side, over-refusal on `targetingSurfaceFor`'s — and
`MatchCreator.svelte`'s own effect comment now carries it, because the source is where a reader of
that effect looks.

### 12.6 What these fixes changed

| File | What changed |
|---|---|
| `src/lib/browser/workspace.svelte.ts` | the mirror, `noticeWriteSurfaces()`, `mirroringLease()`, the three door methods, and four doc comments |
| `src/lib/browser/writeSurfaceRegistry.ts` | the module header's reactivity paragraph — comment only |
| `src/lib/components/DetailPane.svelte` | the restore block's comment — comment only |
| `src/lib/components/MatchCreator.svelte` | the reporting effect's comment — comment only |
| `src/lib/components/DetailPane.test.ts` | `watchSurfaceAnswers`, `creatorTrigger`, two new cases, and the criterion-4 case's assertions |
| `src/lib/components/MatchCreator.test.ts` | the cited case's comment — comment only |

---

## 13. Phase 2d-5-2b-A — the review of 2d-5-2b's own fix round

[`docs/reviews/phase-2d-5-2b-A.md`](../reviews/phase-2d-5-2b-A.md) — **0 blockers**, four should-fix
findings, all four closed. Two changed source and two are prose. The round exists because §12's fix
round changed source, which is `CLAUDE.md` §7.1 and nothing else.

### 13.1 Finding 1 — the guard made authoritative

`writeSurfaceGeneration()` returned `surfaceGeneration` — the reactive mirror *instead of* the
registry's number. It now reads the mirror for the dependency and answers the registry, which is the
shape `openWriteSurfaces()` one method above already used:

```ts
void surfaceGeneration;
return writeSurfaces.generation();
```

**The direction is the argument.** The two doors were only guaranteed equal by every registry-moving
path remembering to mirror, and where that guarantee failed the failure went the unsafe way: this door
would have answered *nothing changed* while `openWriteSurfaces()` answered the new set in the same
synchronous block. The Q5 guard 2d-5-4 captures across an await is exactly the caller that would
believe it. Reading the registry cannot fail that way, and it costs nothing — the dependency is
identical, because the mirror is still read.

**What it does not fix**, said where it is claimed: the mirror is still kept by hand. An unmirrored
path now loses the *invalidation* rather than the *value*, which is a strictly narrower failure and
still not one TypeScript prevents. §11 item 9 carries that correction; the method's own comment and
`BrowserState.writeSurfaceGeneration`'s doc block both say it in the same breath as what they force.

### 13.2 Finding 2 — the mirror's three call sites, covered and mutated

Fixing finding 1 makes every generation assertion an assertion about the **registry**, so nothing left
in the suite could observe the mirror through a number. What can observe it is a reactive consumer
re-running, and `DetailPane.svelte`'s `surfaces={() => browser.openWriteSurfaces()}` feeding
`RestorePane.svelte`'s `$derived.by` is one that draws a sentence.

One case is new — *shows the restore a surface that was re-targeted onto its file*. It registers a
`matchCreator` naming **no file** the way a second host would, which competes with nothing and draws
no refusal, then points it at the restore's own file through `lease.replaceTarget(…)`. That is a pure
registry mutation; the refusal sentence and the disabled *Prepare* can only appear if the mirror moved
with it. It also asserts the wrapper answers `'replaced'`, which is the pass-back half of
`mirroringLease` that no screen shows.

**Every assertion was proven non-vacuous by mutation** — the call commented out, the suite run, the
failing case named, the call restored, the suite run again. `phase-2d-5-2b-A.md` lists this under
"not verified" because that round was read-only; it is verified here:

| `noticeWriteSurfaces()` call site | Case that fails when it is commented out |
|---|---|
| the registration in `registerWriteSurface` | *gives the restore its surfaces from the registry, itself included* **and** *shows the restore a surface that opened after its derived had run* |
| the unregister inside `mirroringLease` | *shows the restore a surface that opened after its derived had run* |
| `replaceTarget` inside `mirroringLease` | *shows the restore a surface that was re-targeted onto its file* |

Each mutation was run alone against the whole file, and 24 of 24 pass with all three calls in place.
**No site turned out to be unobservable**, so no gap is admitted here.

**One thing the table is not.** Mutating the registration does not fail the new case, and that is
correct rather than a hole: the creator that case registers names no file, so the registration it
makes is invisible on screen by design — the mutation it is built to catch is the one on the row
below it.

### 13.3 Findings 3 and 4 — two sentences wider than their code

Both are the defect this chain keeps producing: a claim whose scope exceeds what the code does,
written inside the block that fixed the previous instance. Both were re-derived against the file they
describe rather than re-read.

- **`workspace.svelte.ts`, `writeSurfaceGeneration`'s doc block** said *"Nothing calls it yet"*. The
  unsaid word was **production**: `DetailPane.test.ts` calls it in three cases. The sentence now says
  no caller in production captures it yet, names 2d-5-4 as the step that will, and names the test file
  as today's callers. The neighbouring *"the two doors cannot report different numbers"* claim was
  checked in the same pass and rewritten, because finding 1 changed its justification from *the mirror
  is kept in step* to *both doors answer the registry* — by construction rather than by hand.
- **`MatchCreator.svelte`'s reporting effect** said *"Nothing reads either answer in production at
  2d-5-2b"*. `competingSurfaceFor` is read in production on every open restore, by
  `RestorePane.svelte`'s `current` through `restoreRefusal` (`restore.ts:1993`) and by `permitHolds`
  at the send (`restore.ts:2581`); only `targetingSurfaceFor` has no production caller. The true
  sentence was the clause already beside it — the pane's `busy` rule — and it now carries the
  attribution that `busy` is a fact about `DetailPane.svelte`, not a guarantee of this component's.
  §5 carries the same correction.

### 13.4 The gates, measured

Each run on its own, on the tree as this step leaves it.

| Gate | Result |
|---|---|
| `npm run check` | **438 files, 0 errors, 0 warnings** |
| `npm test` | **59 files, 2254 passed** — up 1 from 2253, the new `DetailPane.test.ts` case |
| `npm run build` | **186 modules** — unchanged, since nothing new is reachable from the entry |

`cargo test --workspace` was not run: no Rust is touched by any of these four fixes, and the
orchestrator had already run it at 1320 passing.

**The module count needs no rebaseline and the bundle oracle was still run**, because the count alone
decides nothing (`CLAUDE.md` §4): `rg -c '\$\$payload|head_payload|push_element'` over the built
bundle matches nothing and `rg -c 'window\.__svelte|svelte-trusted-html'` matches, which is the pair
that discriminates rather than the vacuous `svelte/internal/server` search.

### 13.5 Where it is thin

Marked per `CLAUDE.md` §7.3. No item here commissions a round, and none names a correctness defect in
a source file.

1. **The mirror is still kept by hand — *actionable*.** §11 item 9, unclosed and now narrower: an
   unmirrored fourth path loses the invalidation, not the value. The check is
   `rg -n 'writeSurfaces\.' src/lib/browser/workspace.svelte.ts` plus the two mutations the lease
   performs, which that `rg` never shows. It names no defect today, so it holds nothing open.

2. **The three reactive cases all observe one consumer — *recorded only*.** Every mutation above is
   caught through `RestorePane.svelte`'s `$derived.by` drawing a refusal sentence. That is the only
   reactive reader of this door in the application, so "the mirror moved" and "the restore's refusal
   redrew" are indistinguishable in this suite. A second reader would be the first thing to separate
   them.

3. **§11 item 11 is unaffected and was re-derived, not assumed — *recorded only*.** The restore's
   first reading of the live set is still one step behind for the ordering reason §12.1 measured, and
   none of these four fixes touches the ordering. No correction block was added to it, because adding
   one would have claimed a change that did not happen.

4. **No window has been opened on any of this — *recorded only*.** 2d-5-2c is still the reading that
   is owed, and it now covers a door whose answer changed. A mounted test proves a handler fires; it
   does not prove a window draws.

## 14. Phase 2d-5-2b-B — the review of 2d-5-2b-A's own fix round

`CLAUDE.md` §7.1 commissioned this round: 2d-5-2b-A's fix changed three source files
(`src/lib/browser/workspace.svelte.ts`, `src/lib/components/MatchCreator.svelte`,
`src/lib/components/DetailPane.test.ts`), so a round was owed, scoped to that fix.

One review invocation, `ship-with-fixes`, **0 blockers**, **three SHOULD-FIX** (one of them a Low
with two parts). Report: [`docs/reviews/phase-2d-5-2b-B.md`](../reviews/phase-2d-5-2b-B.md). **All
three were fixed in this phase's commit**, and every figure the review reported was re-derived by the
orchestrator before it was accepted.

### 14.1 Findings 1 and 2 are the recurring defect's seventh and eighth instances

Both are *a sentence whose scope is wider than its code*, and the chain's own record predicted
exactly this: the class *"is not fixed by care, and it is not fixed by being told about it"*. Finding
1's instance is the sharper evidence — **it sits inside the sentence written to fix the sixth
instance**, which is the same shape as the fourth (an instance inside the correction block that
closed the third). What caught both again is what has caught every one of them: a reader re-deriving
a sentence's scope against the code.

### 14.2 Finding 1 — `competingSurfaceFor`'s two production readers, one of them named

`MatchCreator.svelte` claimed `competingSurfaceFor` *is* read in production **"by
`RestorePane.svelte`'s `current` on every open restore"**. Both halves are wider than the code, and
the orchestrator re-derived both:

- **Two production readers, not one.** `restore.ts:1993` inside `restoreRefusal`, which `current`
  reaches; and `restore.ts:2581` inside `permitHolds`, which `sendRestore` calls at `:2663`. **The
  second is the read that decides whether the restore is written**, and it is not reached through
  `current` at all — so the shipped sentence described the *displayed refusal* and said nothing about
  the *spend*. `rg -n 'competingSurfaceFor' src/lib/browser/restore.ts` returns both.
- **Not "every" open restore.** `restoreRefusal` returns one of **six** earlier reasons before the
  call — `alreadyRestored`, `readOnly`, `inFlight`, `conflictShowing`, `noCandidate`, `targetMoved`
  (`restore.ts:1975-1992`). An open restore with no candidate never reaches it. Six was counted off
  the file, not taken from the review.

**A correction to how the previous phase recorded this, since the same error is in two places.**
`92fe0f4`'s commit message says the two sites are reached *"by way of RestorePane's current"* — true
of `:1993`, false of `:2581`. `PROGRESS.md` carried the identical mis-attribution as a **live
pointer** and it is fixed there. The commit message is history and is left as written, per this
chain's own rule that a historical record is a snapshot and only live pointers are maintained.

### 14.3 Finding 2 — "the invalidation and not the value" is false for the caller it is written for

Two sites in `workspace.svelte.ts` (the interface doc block and the implementation comment) said a
future path that moved the registry without calling `noticeWriteSurfaces()` would cost the
*invalidation* and not the *value*, leaving both doors "truthful and neither reactive".

**That is true only of a caller that calls.** A `$derived` over either door **memoizes**: with no
invalidation it never recomputes, so it goes on rendering the number it cached until some *other*
dependency of that derived moves. For the reactive caller — the entire audience the mirror exists
for — a lost invalidation is a **stale screen**, not merely a missed re-run. Both sentences now name
the two audiences separately, and the coordinator capturing the door across an `await` is identified
as the one caller for which the old sentence was the whole truth.

The qualification *"until some other dependency of that derived invalidated it"* is deliberate and is
the narrow claim. Writing a flat *"the value is lost"* would have been the ninth instance of the very
class being fixed.

### 14.4 Finding 3 (Low) — a negative control described as half of an oracle

Two parts in `DetailPane.test.ts`, both confirmed:

- The new case's first half asserts `not.toContain(creatorOpen)` after registering a
  `{ kind: 'unknown' }` creator. That held **before** the registration too, so it passes identically
  whether the mirror moved or the child's `$derived.by` never re-ran — it is a **negative control**,
  not an oracle, and can fail only if an unknown-target creator wrongly *draws* a refusal. The
  comment's *"what makes the two halves of this case different"* invited the stronger reading. The
  comment now says where the evidence starts: below the `replaceTarget`.
- The manually taken lease was never released before `pane.stop()`, unlike the sibling case. It is
  now released after the final assertions.

### 14.5 The NOT-VERIFIED item the orchestrator settled by measuring

The review could not confirm that the Svelte compiler emits a **tracked** read for
`void surfaceGeneration` in a `.svelte.ts` module, and inherited the belief from `openWriteSurfaces()`.
The orchestrator compiled a probe through `svelte/compiler`'s `compileModule` (v5.56.8, `generate:
'client'`, thrown away afterwards) rather than reasoning about it:

```
void surfaceGeneration;   →   void $.get(surfaceGeneration);
```

`$.get` is the tracked read, so the `void` statement **is** a subscription. The item is settled in the
favourable direction, and `writeSurfaceGeneration()`'s reactivity no longer rests on analogy.

**The probe also found something not previously on file, and it is a real hazard rather than a
curiosity.** With **no writer** to `surfaceGeneration`, the same compiler emits a plain
`let surfaceGeneration = 0` and the read is not tracked at all — the signal is optimised away
entirely. So this door's reactivity is contingent on `noticeWriteSurfaces()` continuing to *assign*.
A future change that removed every write would silently make both doors non-reactive, with no type
error, no test failure and no visible difference in the source of either door. That is a **second**
mechanism by which the hand-kept mirror can fail, independent of item 9's "a fourth path forgets to
mirror", and it is §14.6 item 1.

### 14.6 Where it is thin

1. **The mirror's reactivity depends on a writer existing, and nothing checks that — *recorded
   only*.** §14.5 measured it: strip the assignments and the compiler drops the signal, so `void
   surfaceGeneration` becomes a no-op read of a plain number. No test in this repository would fail.
   It names no defect in source today — `noticeWriteSurfaces()` assigns at three sites — so it is a
   residual risk and not a blocker, but it belongs beside item 9 rather than inside it: item 9 is
   about a path that forgets to mirror, this is about there being nothing left to mirror *with*.
2. **`writeSurfaceGeneration()` still has no production caller, so its reactivity is unobserved by
   any mounted case — *recorded only*.** Five call sites across three cases, all in
   `DetailPane.test.ts`. §14.5 settles the compiler question, but the *end-to-end* claim — that a
   `$derived` over this door re-runs on screen — is carried by `openWriteSurfaces()`'s cases and by
   analogy, exactly as before. 2d-5-4 gives it its first production caller and is where that becomes
   observable.
3. **All three reactive cases still observe one consumer — *recorded only*, and unchanged by this
   round.** `RestorePane.svelte`'s `$derived.by` remains the only reactive reader of this door in the
   application, so *"the mirror moved"* and *"the restore's refusal redrew"* stay indistinguishable
   in this suite. This round narrowed what the cases *claim*; it did not widen what they *observe*.
4. **Finding 1's correction is itself a sentence about another module's control flow — *actionable*,
   and it names no defect in source.** `MatchCreator.svelte` now asserts six early returns in
   `restoreRefusal` and a call site at `restore.ts:2663`. Those are true today and were counted off
   the file; they are also exactly the kind of cross-module figure this chain has repeatedly seen go
   stale. A step that edits `restoreRefusal`'s guard list or moves `sendRestore` should re-derive
   them. Adopting this is a later step's choice; nothing here holds a step open.
5. **No window has been opened on any of this — *recorded only*.** Unchanged from §13.5: 2d-5-2c is
   still the reading that is owed, and this round changed only comments and one test-local
   `lease()` call, so it does not move what that reading must cover.

### 14.7 The gates, measured

**`1320 / 438 / 2254 / 186`**, each command run by the orchestrator on its own, and **run twice** —
once on the tree as inherited and once after the fixes.

- `cargo test --workspace -- --test-threads=1` → **1320** passed over **26** binaries, exit 0, and
  the complementary question answered: **no `test result` line lacking `0 failed`**. Run in the
  authoritative serial form per the recorded host scar, and redirected to a file rather than piped,
  per the same scar's third consequence.
- `cargo clippy --workspace --all-targets -- -D warnings` → clean. `cargo fmt --check` → clean.
  `cargo tree -p espansoconfig-core | rg tauri` → finds nothing.
- `npm run check` → **438** files, 0 errors, 0 warnings. `npm test` → 59 files, **2254** passed.
  `npm run build` → **186** modules.
- **Both bundle oracles read, both lines reported**: server-only markers `$$payload|head_payload|
  push_element` **absent**; client-only markers `window.__svelte|svelte-trusted-html` **present (2)**.

**No count moved, and that is the expected result.** The fix changed three comments and added one
`lease()` call inside an existing case — no file entered or left the program, no new module, no new
case. **The Rust half was proven untouched** rather than assumed: `git diff --stat` over the fix
shows no path under `crates/` or `src-tauri/`, so the figure measured before the fix could not move.

### 14.8 What this round commissions

**The fix round changed three source files** — `workspace.svelte.ts`, `MatchCreator.svelte` and
`DetailPane.test.ts`, all comments except the one added `lease()` call. Under §7.1 the unit is the
file and a comment-only change to a source file counts, so **a round is owed and it is 2d-5-2b-C's**.
`PROGRESS.md` and this notes file are on §7's closed list and do not count.

**The chain is six phases deep and has not reached the ending 2d-5-1's and 2d-5-2a's found.** §7.2
says in as many words that this is the mechanism working rather than failing. The escape hatch is
`BLOCKED` under §7.2 and it is **not** reached: this round returned 0 blockers, its three findings
were independent rather than one defect surviving its own fix, and §14.6 names **no correctness
defect in a source file** — item 4's *actionable* mark is on a cross-module figure that is currently
true, which §7.3 does not blocking-qualify. What *would* reach the hatch is a round whose finding is
this fix reintroducing what it closed, and 2d-5-2b-C is the round positioned to see it.

---

## 15. Phase 2d-5-2b-C — the review of 2d-5-2b-B's own fix round

### 15.1 Why this phase existed

2d-5-2b-B's fix changed three source files — `src/lib/browser/workspace.svelte.ts`,
`src/lib/components/MatchCreator.svelte` and `src/lib/components/DetailPane.test.ts`. Under §7.1 the
unit is the file and a comment-only change counts, so a round was owed and this is it. It was scoped
to that fix and to nothing else: the rest of `4f1fdb3` is `PROGRESS.md`, this notes file and
`docs/`, all on §7's closed list.

One review invocation. Verdict **`ship-with-fixes`**, **0 blockers**, **three SHOULD-FIX** and
**three NITs**. All six were fixed in this phase's own commit. The report is
[`docs/reviews/phase-2d-5-2b-C.md`](../reviews/phase-2d-5-2b-C.md).

### 15.2 Every figure was re-derived before it was accepted

The orchestrator counted each citation off the files rather than taking it from the review, and every
one held. `RestorePane.svelte:340` builds `surfaces: surfaces()` inside `current`'s `$derived.by`;
`:509` captures `const now = current`, `:510` hands `now.context` to `confirmRestore` and `:511`
passes `now.context.surfaces` onward. `restore.ts`: `restoreRefusal` 1971-1995, `canPrepareRestore`
2005-2010 calling it at `:2009`, `prepareRestore`'s gate at `:2095`, `confirmRestore`'s at `:2397`,
`restoreView` 3203-3246 reading it at `:3228`, `permitHolds` 2550-2582 and `sendRestore`'s call at
`:2663`. `workspace.svelte.ts:3320-3322` rebuilds the `RestoreContext`, and its own comment at
`:3319` already said *"The surfaces half is the caller's"*. The `$derived`-or-`$effect` wording
exists correctly at `:1570`, at `:3407` and in the `mirroringLease` comment near `:1808`. And
`rg -n 'writeSurfaceGeneration' src/ --glob '!*.test.ts'` finds a declaration, an implementation and
a comment — **no production caller at all**.

### 15.3 The three SHOULD-FIX findings

**Finding 1 — `MatchCreator.svelte`: "not reached through `current` at all" is false.** The sentence
2d-5-2b-B wrote to fix its own finding 1 claimed the `restore.ts:2581` read is not reached through
`current`. The *call* is not made from inside `current`'s derivation — but the **surface list it
judges is `current`'s**, built once in that `$derived.by` and carried through `runRestore` into the
coordinator, which re-reads only `observed`. The comment now says which half is true.

**Finding 2 — `MatchCreator.svelte`: the first read is not display-only.** The same sentence called
`:2581` *"the read that decides whether the restore is written"*, and contrasted it with a claim that
*"names only the drawn refusal describes the display and not the spend"*. But `:1993` sits in
`restoreRefusal`, which `canPrepareRestore` reaches, which gates **`confirmRestore`** — the call that
mints the permit. A competing surface seen at `:1993` stops the write before `:2581` is ever reached.
**Both reads decide whether the restore is written**, and the live comment at
`RestorePane.svelte:106-111` had said so all along: *"`prepareRestore` and `confirmRestore` are handed
the very same object"*. The fix corrected `MatchCreator.svelte`, the side that was wrong; the
`RestorePane` comment is right as written and is untouched.

**Finding 3 — `workspace.svelte.ts`: the two-audience split omits `$effect` and template reads.**
2d-5-2b-B's finding 2 had split the cost between *"an imperative caller"* and *"a `$derived`"*. An
`$effect` **calls**, so that wording sorts it into the arm that pays nothing — and it is stale
exactly as the derived is, because nothing invalidates it either. A template read is a render effect
and is the same case. **The line is the reactive context, not whether the caller calls.** Both
rewritten sites — the `BrowserState` JSDoc and the implementation comment — now say so, which also
ends their disagreement with the correct wording earlier in that same comment and with the sibling
door's JSDoc.

### 15.4 The three NITs, all fixed

**NIT 4** — the JSDoc called a coordinator *"the one caller"* for which the invalidation is the whole
truth, in the paragraph directly after the one saying no production caller exists yet and that the
callers it has today are cases in `DetailPane.test.ts`. Those tests are the same kind. It is now a *kind*, not a
count.

**NIT 5** — `DetailPane.test.ts`'s new comment said the first half *"can fail only if registering an
unknown-target creator wrongly draws a refusal"*, but that half is **two** assertions and the claim is
true of one. The neighbouring `disabled` assertion fails on `noCandidate` or `targetMoved` with no
creator refusal drawn. The comment now says what each assertion is worth, and says what the negative
control is *for* — it is what makes the `toContain` below a **change** — instead of implying it is
surplus.

**NIT 6** — *"Released before the pane stops, as the sibling case above does"*. The sibling's
`lease()` is an **observed step** with a `flushSync()` and four assertions after it; this one is bare
cleanup after the last assertion. The comment no longer borrows the sibling's reason. It also records
what was measured here: `mountPane`'s `stop()` unmounts the component and removes the target but
**does not dispose the state**, so the release is symmetry of placement rather than a leak avoided.

### 15.5 Three defects this phase introduced into its own fix and caught before committing

Recorded because the chain's failure mode is precisely a fix that ships a new instance of what it
closed, and because catching them is the only reason this round's diff is not itself a ninth
generation:

1. *"as this docblock says three paragraphs above"* — the docblock has **two** paragraphs and the
   claim sits in the one directly above. Counted, then corrected.
2. *"Fifteen lines above ... the class is written correctly"* — measured at **26** lines. Replaced
   with *"at the top of this same comment"*, which cannot rot.
3. *"the narrow wording was this site's alone"* — **false**: the JSDoc twin had it too, and this
   phase fixed both. Replaced with a sentence naming both sites.

Each was found by re-deriving the figure against the file, never by re-reading the sentence.

### 15.6 The `BLOCKED` question, asked because §14.7 named this exact round

§14.7 ended by saying the escape hatch would be reached by *"a round whose finding is this fix
reintroducing what it closed, and 2d-5-2b-C is the round positioned to see it"*. **All six findings
this round returned are in text 2d-5-2b-B wrote.** The question therefore has to be answered rather
than skipped, and the answer is that the step is **not** `BLOCKED`. Four reasons, in order of weight:

1. **"All findings are in the fix's text" is tautological here, not evidence.** §7.1 scopes the round
   *to that fix*, so a finding outside it would be out of scope. Non-convergence cannot be read off a
   property the scoping rule guarantees.
2. **No finding names a correctness defect in executable source.** Every changed line in this phase's
   diff is a comment — verified mechanically, not by eye — and both suites are unmoved at 1320 and
   2254. §7.2's hatch is for a genuine correctness blocker; §7.3's is for a correctness defect in a
   source file. A wrong comment in a source file is a defect in the record, which §7.3 explicitly
   does not blocking-qualify.
3. **Nothing is carried.** All three *actionable* items in the review's "where it is thin" were fixed
   in this phase, so no known defect closes with the step.
4. **The precedent is that these chains terminate.** 2d-5-2a ran four phases of exactly this shape —
   each fix creating a new instance of one prose defect — and closed **by rule** when a round's
   findings landed only in the record.

**What would reach the hatch, stated so the next round can apply it rather than re-argue it**: a
round whose findings are the *same* mis-attribution this phase just corrected — the reachability of
`restore.ts:1993` versus `:2581`, or the reactive-context split — reappearing in the sentences written
here. That would be one defect surviving two consecutive fixes aimed directly at it, which is
divergence rather than scope. A round returning *different* defects in the same three files is the
tail doing its job, and is answered under §7.1 as usual.

### 15.7 The gates

Measured by the orchestrator alone and **twice** — once on the tree as inherited, once after the
fixes — each command run on its own, and unmoved at **`1320 / 438 / 2254 / 186`**.

`cargo test --workspace -- --test-threads=1` → exit 0, **1320** passed summed over **26** `test
result` lines, and the complementary question asked: **no line lacking `0 failed`**. Redirected to a
file, never read through a pipe, per the host scar in `PROGRESS.md`. `npm run check` → **438 files, 0
errors, 0 warnings**. `npm test` → 59 files, **2254 passed**. `npm run build` → **186 modules**.
Clippy, `cargo fmt --check` and `cargo tree -p espansoconfig-core | rg tauri` (finds nothing) all
clean. **Both bundle oracles read and both reported**: server-only markers **absent**, client-only
**present (2)**.

**The Rust half was proven untouched rather than assumed** — `git diff --stat` over this phase's fix
shows no path under `crates/` or `src-tauri/` — so the Rust figure was measured before the fix and the
fix could not move it. No count moved, which is what a comment-only diff should do: no file entered or
left the program, no new reachable module, no new component, no new case.

### 15.8 Where it is thin

1. **The two sentences this phase rewrote in `MatchCreator.svelte` trace reachability across three
   files** (`MatchCreator.svelte` → `RestorePane.svelte` → `restore.ts` → `workspace.svelte.ts`), and
   nothing executable holds that trace together. Any of the six line citations rots the moment a
   function moves. — *recorded only*.
2. **No executable test pins any sentence this chain has argued over.** The suites check parity and
   behaviour, never attribution; reverting any of these six fixes leaves 2254 tests green. This is the
   gap `CLAUDE.md` already names, and six rounds have now lived in it. — *recorded only*.
3. **`writeSurfaceGeneration()` still has no production reader**, so every sentence about its audience
   — including the ones this phase corrected — describes a caller that does not exist. 2d-5-4 is the
   step that creates one, and it is the first thing that can falsify any of it. — *recorded only*.
4. **`RestorePane.svelte:106-111` and `MatchCreator.svelte`'s block now agree, and nothing enforces
   that they stay agreeing.** They were contradictory for one whole round before this one. — *recorded
   only*.
5. **All three reactive cases still observe one consumer** (`RestorePane.svelte`'s `$derived.by`), so
   *"the mirror moved"* and *"the restore's refusal redrew"* remain indistinguishable in this suite —
   §14.6 item 3, unchanged and not narrowed by this round. — *recorded only*.
6. **The mirror's reactivity is still contingent on a writer existing** — §14.6 item 1. Three sites
   assign today; remove every write and the compiler optimises the signal away with nothing failing.
   — *recorded only*.

**No item here is actionable, and that is a statement about this round's findings rather than a
convenience**: the three the review marked actionable were all fixed in this phase, so none is
carried.

### 15.9 What §7.1 says next

This phase's fix changed **three source files** — `src/lib/browser/workspace.svelte.ts`,
`src/lib/components/MatchCreator.svelte` and `src/lib/components/DetailPane.test.ts` — every changed
line a comment. The unit is the file, so **§7.1 commissions a round, and it is 2d-5-2b-D**, scoped to
this fix. `PROGRESS.md`, this notes file and the review report are on §7's closed list and count for
nothing.
