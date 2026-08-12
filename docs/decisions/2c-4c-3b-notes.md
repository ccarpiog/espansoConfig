# Phase 2c-4c-3b — the four surfaces that recover without creating

**Step 2c-4c-3 was split in two by the orchestrator.** 3a built the recovery panel, its words and
the two surfaces that can create. This is **3b**: `MatchDeleter.svelte`, `MatchMover.svelte`,
`MatchDuplicator.svelte` and `RawEditor.svelte` — the four `recoveryAvailability` answers
`unavailable` for. **They draw a reason, not a form**, and with 3b the consult's step-3 matrix is
complete on all six surfaces.

The phase's cut is `PROGRESS.md` § "Phase 2c-4c — consult disposition"; the consult is
`docs/reviews/phase-2c-4c-design.md`; 3a's record is `docs/decisions/2c-4c-3a-notes.md`.

---

## 1. What this step built

**One model function, one model change, one shared renderer and sixteen mounted cases.**

- `src/lib/browser/recovery.ts` gained `recoveryWithoutCreation(kind, conflict)` and the
  `RecoveryWithoutCreationKind` it takes, and **changed one ordering** in
  `recoveryAvailability` — §2.2 is that change and why 3b is the first step that could
  see it needed making. **No transition changed**, no string was added and no dictionary was
  touched.
- `src/lib/components/RecoveryWithoutCreation.svelte` is **the one renderer of that answer**,
  added by the round-1 fix round: it calls the model function itself and owns the decision to
  draw. The four components each gained one import and one unconditional mount — no `{#if}`,
  no `$derived` and no accessor call of their own. None of them mounts `RecoveryPanel.svelte`.
- Mounted evidence: four cases on each of `MatchDeleter.test.ts`, `MatchMover.test.ts`,
  `MatchDuplicator.test.ts` and `RawEditor.test.ts`, each of which proves **the shared renderer
  is mounted** and not merely that the words are on screen.
- Model evidence: four cases on `recovery.test.ts`, one of them the ordering and three of them
  the new function, including the agreement §2.3 rests on.

---

## 2. The decisions

### 2.1 D1 — the four do **not** mount `RecoveryPanel.svelte`, and one shared renderer draws what they do

**What the panel is cannot be reused here.** Its `aria-label` is *A new snippet from supported
fields*; its heading is that; its transfer table, its destination list, its two boxes and its
create control are all about the product these four surfaces cannot make. Mounting it on the
deleter would put a landmark named after a new snippet on a screen that is deleting one, and
would require its three collaborator props — `open`, `create`, `adoptDiskVersion` — to be made
optional or nullable on the two hosts that must never be without them. **A prop that may be
absent on the surface that creates is the "a control could compile and do nothing" failure this
project names**, and it would have been paid to reuse thirty characters of markup. That part of
this decision is unchanged, and the round-1 review agreed with it.

**What the review rejected is what replaced it, and this section made a false claim about that.**
As first written, 3b gave each of the four components its own `{#if}` over
`recoveryWithoutCreation`'s answer and its own call to `tRecoveryUnavailable` — a second recovery
renderer, four times. The model function centralised *which* reason and *whether there is one*;
it did not centralise **drawing**, so a host could omit the paragraph entirely while consuming
the model faithfully. That is precisely 2c-3c-3's failure mode: a rule written into one renderer
is carried by that renderer's mounted suite alone, and a second renderer can omit it while
walking the model faithfully. This record then claimed *"one function, six callers, one suite"*
of it. **That sentence was false**: the callers were four **components**, the two creating
surfaces call `recoveryAvailability` and not this function, and no model suite can prove that any
component renders an answer.

**What draws it now is `src/lib/components/RecoveryWithoutCreation.svelte`**, and it is one
renderer for four hosts exactly as `RecoveryPanel.svelte` is one renderer for two:

- **It owns the decision to draw.** It takes the conflict and the surface's draft kind, calls
  `recoveryWithoutCreation` itself and draws nothing when the answer is `null`. **No host carries a
  condition about the sentence**: the tag stands unwrapped in all three match panels, and in the
  raw editor the only block above it is the one that decides whether there is an editor at all. So
  there is no per-host condition to get wrong and none to forget.
- **It calls the accessor.** `tRecoveryUnavailable` is imported here and nowhere else among the
  four; a component renders a code by calling an accessor, never by building a key.
- **It is generic in the drafted value.** `ConflictModel<T>` is invariant in `T` — its draft
  carries that value's own comparison rules — so a `ConflictModel<MatchId>` is not a
  `ConflictModel<unknown>` and `generics="T"` is what lets one renderer take all four surfaces'
  conflicts without a cast. Nothing in it reads the drafted value.
- **It carries its own `<style>`.** Svelte scopes styles, so a host's `.kind` rule cannot reach an
  element this component owns; the rule is repeated here rather than inherited. Each host's own
  `.kind` is still used by twelve to nineteen other paragraphs of its own markup, so nothing
  became a dead selector — which `npm run check` would have failed on, `--fail-on-warnings`
  treating an unused CSS selector as a warning.
- **Each host's mounted suite proves it is mounted, not merely that the words appear.** The
  component marks its paragraph with `data-recovery-without-creation`, whose value is the reason
  **it** derived; `RECOVERY_WITHOUT_CREATION_ATTRIBUTE` is exported from its own `<script module>`
  and the four suites query through that constant. A surface that stopped mounting it — or that
  went back to drawing the sentence itself — fails there even though `says()` would still find
  identical words on screen. The attribute is not user-facing, is not translated and is given to
  no assistive technology.

`recoveryWithoutCreation` therefore has **one production caller** and its own suite, and the
sentence four screens show is one paragraph in one file.

### 2.2 D2 — `recoveryAvailability` asks about the conflict first, and 3b is where that was visible

Until this step the route check came first, so a surface whose route is not `createsSnippet`
answered `operationDraft` or `wholeDocumentDraft` **whatever was happening** — no conflict, no
save, nothing sent. `recoveryIsAnswerable` calls both of those worth a sentence, so drawing
recovery on those four surfaces at all would have put a permanent paragraph — *"Load the version
on disk, choose a snippet in it, and ask again"* — on a screen where no version on disk was in
dispute.

**3a's own record predicted the sentence that was not true.** D4 there describes
`notFromManualResolution` as *the ordinary state of a conflict nobody has pressed Keep my draft
on — and of every surface with no conflict at all*. That was true of the two surfaces 3a drew and
false of the four it did not: with no conflict, those four answered their own reason. The
ordering change makes the claim true of all six, and the JSDoc on `recoveryAvailability`,
`recoveryIsAnswerable` and the module header now says so in the code rather than only here.

**Nothing changes for a surface that can create.** With a conflict every answer is what it was;
without one the answer moves from `notFromManualResolution` to `noConflict`, and both are
refusals `recoveryIsAnswerable` draws nowhere. The existing model and workspace suites pass
untouched because every assertion in them supplies a conflict.

**The route check still stands above the reapply check, and that is load-bearing.** The raw
editor's `reapplySupport` is `unavailable`, so it can never produce a `manualResolution`; an
entry condition written on one would have silenced its sentence permanently. Putting the
conflict check first and leaving the reapply check last is the only order that gives all six
surfaces a truthful answer, and `RawEditor.test.ts`'s conflict case is what fails if it is
reversed.

### 2.3 D3 — the narrow entry delegates rather than re-deciding

`recoveryWithoutCreation` calls `recoveryAvailability` with a `null` attempt and two empty
document lists. That is safe only because a route that is not `createsSnippet` reaches neither
the reapply check nor `recoveryDestinationsOf` — **a property of one ordering in one function,
not of this signature**. So it is stated on the function and **driven**: `recovery.test.ts` runs
the full gate over every reapply arm and a populated window, and asserts one answer against the
narrow one. A later reordering fails there instead of quietly making four screens go silent.

Its parameter type is `Extract<RecoveryDraftKind, …>` rather than a second literal union, so a
creating kind cannot be passed and a renamed member is a compile error here.

### 2.4 D4 — the sentence sits where the two creating surfaces draw their form

Between the reapply report and the outcome panel, on all four, which is where 3a put the panel on
the editor and the creator. Six surfaces therefore say what recovery is in the same place. The
alternative — inside the conflict arm — would have read better in isolation and would have made
the position differ from the two surfaces a person is most likely to compare it with.

### 2.5 D5 — the raw editor keeps its copy, and that is half of what its sentence promises

`browser.recovery.unavailable.wholeDocumentDraft` says *carry on editing, copy your text, compare
it with the version on disk, or load that version*. Three of those four are the conflict panel's
existing choices and the fourth is the box above it. The mounted case asserts the **copy control
is still there** beside the sentence, because a sentence naming a control that is not drawn is
this project's worst defect class in the medium where no type checks it.

---

## 3. What this step deliberately did **not** do

- **No new control on any of the four.** No copy on the three operation surfaces —
  `conflictChoicesFor` refuses one for an `operationChoice` whatever a surface declares — and no
  save-as-new anywhere, including the raw editor.
- **No new `sendRecoveryCreate` call site**, and none was needed: none of these four creates.
- **No new string, in either language.** The two sentences 3b draws were written at 3a and are
  reached through `tRecoveryUnavailable`, an accessor, never a hand-built key. The one thing the
  fix round added to the DOM — `data-recovery-without-creation` — is a test marker: nothing
  renders it and no assistive technology is given it.
- **`browser.saveOutcome.reloadClosesSurface` was not touched.** It is on the standing debt
  ledger and changing it obliges a re-taken 2c-4a-3c window reading.
- **No Rust file was touched**, and no transition in `recovery.ts` changed.
- **`RecoveryPanel.svelte`, `MatchEditor.svelte` and `MatchCreator.svelte` were not touched.**
- **No window reading.** That is 2c-4c-5, and 2c-4c-4 has to rebuild the instrument first.

---

## 4. What this step does not cover, stated as holes

### 4.1 No screen has been read

A green suite is not a screen. Nothing here has been seen in a running window in either language:
not where the sentence lands inside an already long conflict panel, not whether it reads as
preempting *Keep my draft* on the three operation surfaces, and not whether the raw editor's
sentence sits close enough to the controls it names for the two to be read together. 2c-4c-5 is
the reading, and it is owed for six surfaces.

### 4.2 The sentence appears as soon as a conflict does, not only after a reapply

On the three operation surfaces the sentence stands beside a conflict nobody has yet pressed
*Keep my draft* on. That is deliberate — it has to be, or the raw editor could never show
its own — and it is the one place where 3b's behaviour is a judgement rather than a derivation.
Whether it reads as discouraging the reapply that is offered a few lines above it is a question
for the window reading, and it is recorded here rather than assumed away.

### 4.3 No executable test pins what either sentence means

The i18n suites check key parity and placeholder agreement, never meaning. That
`operationDraft` names an action on a snippet and `wholeDocumentDraft` names a whole file, and
that neither claims anything about espanso semantics, is carried by review.

### 4.4 What no type forces

That a host mounts `RecoveryWithoutCreation.svelte` with the kind its own surface really drafts —
nothing ties `kind="operationChoice"` in `MatchDeleter.svelte` to `matchDeletion.ts`'s own
`CONFLICT_CAPABILITIES.draftKind`, and a host passing the wrong one would compile and draw a
plausible wrong sentence. What catches it is each surface's mounted case, which asserts the reason
the shared renderer derived **and** that the other surface's sentence is absent.

**And that a host mounts it at all.** The shared renderer removed the failure mode where a host
silently drew nothing while the model was consulted correctly, but nothing in TypeScript makes the
mount obligatory: a surface that deleted the tag would compile. What fails then is that surface's
own `recoveryNote` assertion, in its own mounted suite — the same shape of guarantee as every
other markup rule this project relies on, and stated here rather than claimed away.

### 4.5 The module count moved by two, and that is the expected reading

**178 → 180.** The fix round added one component, `RecoveryWithoutCreation.svelte`, and the ladder
in `CLAUDE.md` prices a **styled** component at two: the component is one module and its `<style>`
block is a module of its own. That was predicted before the component was written and then
**measured here rather than inherited from 2c-4c-3a**: deleting the `<style>` block and rebuilding
gives **179**, restoring it gives **180** again. No `.ts` module was added, so there is nothing
else to account for. `svelte/internal/server` is **not** in the bundle, which is
the regression the guard exists to catch — and it is checked rather than read off the number,
because 180 is also what the old shorthand for that regression named. `rg` over
`dist/assets/index-*.js` and `dist/index.html` finds no `internal/server`, no `svelte/server` and
no `async_hooks`.

---

## 5. Evidence

All five gates, run from the project root, each as its own command:

| Gate | Before (3a) | After | Note |
|---|---|---|---|
| `cargo test --workspace` | 1112 passed, 0 failed | **1112 passed, 0 failed** | no Rust file was touched |
| `npm test` | 1744 passed, 51 files | **1767 passed, 51 files** | see the arithmetic below |
| `npm run check` | 422 files, 0 errors, 0 warnings | **423 files, 0 errors, 0 warnings** | one new file; `--fail-on-warnings` |
| `npm run build` | 178 modules | **180 modules** | §4.5 |
| `cargo clippy --workspace --all-targets -- -D warnings` | clean | **clean** | |

`cargo tree -p espansoconfig-core | rg tauri` finds nothing.

**The test count, accounted for.** 1744 → 1767 is **+23**. Twenty are cases this step wrote: 4 in
`recovery.test.ts` and 4 in each of the four mounted suites. The other **three are not new cases
at all** — they are one row each in the three per-source-file `it.each` scanners, which enumerate
what is under `src/lib/`, and `RecoveryWithoutCreation.svelte` is one file more for them to walk:
that it hands `t()` a written key rather than a built one, that its markup holds no literal
user-facing text, and that it does not name the developer-string accessor. The step's first
round added no file and so moved none of the three; the fix round adds exactly one file and moves
each by one.

**What the mounted cases hold**, which is the negative half of the consult's step-3 matrix:

- **the deleter, the mover and the duplicator offer neither copy nor save-as-new** — no control
  named by `recoveryChoiceKey`, no recovery form label, heading or destination list anywhere on
  the screen, and no `copyDraft` control — while the conflict really is on screen, so each
  absence is about the control and not about the panel;
- **the raw editor offers no save-as-new** and **keeps the copy it already had**, which is the
  half of its own sentence that would otherwise be a promise the screen does not keep;
- **each surface mounts the shared renderer, and each draws its own reason and not the other's** —
  the assertion is on `data-recovery-without-creation`'s value, so a host that drew the sentence
  itself fails even with identical words on screen, and a host wired to the wrong draft kind fails
  rather than drawing a plausible wrong sentence;
- **nothing is said until something has gone wrong** — the shared renderer is mounted on a freshly
  opened panel and has drawn nothing, which is D2's defect seen from the screen;
- **the original conflict survives every non-committed ending the surface can reach.** On the
  deleter, the mover and the duplicator that is **three**: a reapply that resolved nothing, a
  reload asked for and not confirmed, and a reload the window refused. On the raw editor it is
  **two** — its `reapplySupport` is `unavailable`, so a *Keep my draft* that resolves nothing is
  not a state that screen can be in, and `RawEditor.test.ts` exercises the two reload endings and
  claims no third. In every one of those endings the sentence is still drawn — and since the shared
  renderer answers `null` whenever there is no conflict, the sentence standing **is** the evidence
  that the conflict is still there — **nothing was sent a second time**, no unasked adoption was
  performed, and **`close` was not called**. The last of those is asserted on every tested ending of
  all four surfaces, because the suites' `close` is a spy rather than a parent unmount: a surface
  told to close would go on rendering, so continued rendering is not evidence and the call count is;
- **the one ending that removes the sentence is the person's own dismissal**, which removes the
  conflict with it — recovery is about a conflict, and after *Keep editing* there is not one. That
  ending writes nothing either, so it asserts `close` was not called too.

---

## 6. Review

3a's record §6.5 put the once-per-phase adversarial review of 2c-4c-3 **after 3b**, when all six
surfaces are drawn and the matrix is complete, on the ground that splitting it would review half a
matrix twice. **That review ran, and it returned NOT READY**: one High and one Medium,
`docs/reviews/phase-2c-4c-3b-code.md`. Both were fixed by doing the work rather than by narrowing
a claim.

**H1 — four copied renderers, and a false sentence in this record.** §2.1 above is the fix and the
correction: the shared renderer exists, the hosts mount it unconditionally, each host's mounted
suite proves the mount, and *"one function, six callers, one suite"* is gone because it was not
true of what shipped. The review named two acceptable fixes and the first was taken; the second —
redesigning `RecoveryPanel.svelte` into a discriminated form/reason renderer — was not, for §2.1's
original reason, which the review did not dispute.

**M1 — the evidence record over-claimed on one surface, and no raw case asserted `close`.** §5's
ending bullet now distinguishes the raw editor's two reachable endings from the three match
surfaces', and **every ending this step enumerates** asserts `close` was not called: the three
surviving endings on each match surface, the two on the raw editor, and the dismissal — which the
finding did not name and which is an ending that wrote nothing all the same.

**That sentence over-claimed in its turn, and round 2 found it.** Its first version said *every
tested non-committed ending on all four surfaces*, which is a claim about the whole of four suites
rather than about this step's cases, and four pre-existing no-write endings did not assert it: the
mover's `alreadySatisfied` and its refused reapply, the duplicator's refused reapply, and the
deleter's refused renewed confirmation. **The orchestrator closed all four by doing the work** —
`alreadySatisfied` in particular is a distinct ending rather than duplicate coverage of the three —
and narrowed this sentence to what is enumerated, because the review's list was prefixed *including*
and an exhaustiveness claim over four suites is not something this step verified. **Nothing here
claims every no-write ending in the four suites asserts it**; what is claimed is the enumerated set
plus those four.

**What this fix round did not touch**, deliberately: `browser.saveOutcome.reloadClosesSurface`
(standing debt ledger, and changing it obliges a re-taken 2c-4a-3c window reading), the
`recoveryAvailability` ordering (the review verified it with a complete disagreement matrix and
cleared it), and the six surfaces' controls — no create, copy or save-as-new was added anywhere.

**What the round-2 review inherits.** *A fix is a change*: the shared renderer, its marker
attribute, the four hosts' edits and this record's two corrections have not themselves been
reviewed. It also still inherits **3a's four round-1 fixes**, which have never been reviewed
either, and §2.2's ordering change — a model change made in a step whose brief was to draw, which
round 1 examined and cleared.

**And the reading is still owed.** §4.1 is unchanged by the fix round in substance and sharper in
one respect: the paragraph four screens draw is now a child component with its own scoped style
rule, so 2c-4c-5 is reading markup no window has shown yet — the same words, drawn by a different
element.
