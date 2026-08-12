NOT READY

## Findings

### 1. High — An uncertain create can replace the projection while recovery still claims the source conflict is intact

**Location:** `src/lib/browser/workspace.svelte.ts:2351`, `src/lib/browser/recovery.ts:994`, `src/lib/browser/recovery.ts:1589`, `src/lib/browser/recovery.test.ts:860`, `docs/decisions/2c-4c-2-notes.md:137`

`sourceConflictRetained` is only `!session.committed`. On a failed command,
`sendRecoveryCreate` folds `mayHaveWritten` into a notice and leaves `committed`
false. The real callback it is specified to compose does more: when
`BrowserState.createMatch` receives a failure for which `mayHaveWritten` is true,
it calls `adoptTheDocumentOnDisk`. That re-read can replace the projection,
repair or move the selection, and advance the projection generation against
which the source conflict's one-shot authorization was registered. The recovery
session then says the source conflict is retained even though the window state
that made it intact may already have been replaced.

The same mismatch exists on the legal `saved, committed: false` arm. Because a
recovery create is based on the conflict's disk revision while the window still
projects the older revision, `BrowserState.createMatch` treats the result as out
of date and adopts it (`src/lib/browser/workspace.svelte.ts:2361`), while
`applyRecoveryCreate` retains the source conflict because `result.committed` is
false (`src/lib/browser/recovery.ts:1394`). The record explicitly claims that arm
retains the conflict. This is the named claim-versus-code defect class, not just
an omitted test.

The uncertain-send test cannot expose the problem: its `recordingCreate`
callback merely returns `{ kind: 'failed', mayHaveWritten: true, ... }` and never
executes the wrapper's recovery/adoption path. It therefore observes an intact
model after omitting the production side effect that can make it non-intact.

**Minimal fix:** make the callback answer carry whether its failure/non-committed
result replaced the projection, and make the recovery state distinguish an
intact source conflict from one invalidated by that reconciliation. If the brief's
stronger “retained until a known commit” rule is non-negotiable, the wrapper
protocol must first be redesigned so an uncertain write can be reconciled
without silently invalidating that source context. Add real-`BrowserState`
workspace cases for `mayHaveWritten: true` and `saved, committed: false`; assert
the projection, selection, authorization usability, and the recovery view
together.

### 2. Medium — `reapplySupport: 'supported'` falsely says this form has a transition

**Location:** `src/lib/browser/saveOutcome.ts:281`, `src/lib/browser/saveOutcome.ts:306`, `src/lib/browser/recovery.ts:1604`, `src/lib/browser/recovery.ts:1618`, `docs/decisions/2c-4c-2-notes.md:183`

`ConflictReapplySupport` is documented as the permanent answer to whether a
surface can have a reapply transition, and its `supported` variant is narrower:
“This surface has a reapply transition.” Recovery declares `supported` while its
own comment and decision record both admit that no recovery reapply transition
exists. `offersReapply: false` only withholds a control; it does not change the
permanent fact represented by the other field.

The record attempts to reinterpret `supported` as “one could perhaps be honest
later,” despite the existing variant contract. That leaves downstream code with
a well-typed declaration that is false today and makes step 3 appear able to flip
one offer boolean over machinery that is not present.

**Minimal fix:** build and test the recovery form's unoffered reapply transition
in this model step, then retain `supported`; otherwise change the capability type
so “possible in principle” and “implemented transition” are separate states and
declare the current state honestly. Do not use `offersReapply` to paper over the
false permanent capability.

### 3. Medium — A recovery conflict advertises reload consequences but has no reload path and only retries the stale base

**Location:** `src/lib/browser/saveOutcome.ts:812`, `src/lib/browser/saveOutcome.ts:837`, `src/lib/browser/recovery.ts:1481`, `src/lib/browser/recovery.ts:1579`, `src/lib/browser/recovery.ts:1612`, `src/lib/browser/recovery.ts:1756`, `docs/decisions/2c-4c-2-notes.md:294`

`describeConflict` unconditionally appends a reload warning. Recovery declares
`offersReload: false`, supplies no reload transition, and exposes only
`keepEditing`. `keepRecovering` merely removes the conflict outcome; it neither
adopts the new disk projection nor retargets the draft. The next send therefore
uses the same frozen destination revision and conflicts again. The supposedly
truthful “way out” is a loop, while the messages describe an action the value
cannot perform.

Recording this mismatch as a hole does not make the outcome model coherent, and
it contradicts this step's explicit precedent that an unoffered transition is
built and tested before the later UI step flips capability. This is distinct from
Finding 2: even if reapply were declared unavailable, the reload warning and
dead-end retry would remain.

**Minimal fix:** add the unoffered recovery-conflict reload transition now,
including retargeting/reseeding from the adopted disk projection, and test that
it breaks the stale-base loop while retaining the source recovery draft as the
design permits. Until such a transition exists, do not include a reload warning
in this form's messages or describe `keepEditing` as a way out.

### 4. Medium — Both “no command” tests inspect mocks that the exercised code cannot call

**Location:** `src/lib/browser/recovery.test.ts:1090`, `src/lib/browser/recovery.test.ts:1095`, `src/lib/browser/workspace.test.ts:4943`, `src/lib/browser/workspace.test.ts:4961`, `src/lib/browser/workspace.test.ts:4980`, `docs/decisions/2c-4c-2-notes.md:359`

The model test creates a `create` mock, never passes it to any function, calls only
`recoveryAvailability`, and then asserts that the untouched mock was not called.
The workspace test repeats the same shape at a larger scale: it calls the same
pure availability function, which receives neither `BrowserState` nor its command
surface, then asserts that six unrelated command mocks were untouched. Even a
defect that imported and invoked an IPC command directly from a different
recovery transition would not be observed by those mocks.

The availability assertions correctly prove that operation-choice and
whole-document drafts receive no create offer. They do not prove the separately
claimed property that those recovery routes call no command, so the decision
record's evidence table overstates what is falsifiable.

**Minimal fix:** put each non-creating route through the public recovery
transition/dispatcher that a later caller will actually invoke and inject the
observable boundary into that path, then assert zero calls. While no such entry
exists, replace the vacuous mock assertions with a falsifiable dependency check
that fails if `recovery.ts` gains a value import or call to the IPC command layer,
and describe the evidence only as “no create offer.”

### 5. Low — The scoped artifacts repeatedly describe recovery with the three prohibited product names

**Location:** `PROGRESS.md:6945`, `src/lib/browser/recovery.ts:5`, `src/lib/browser/recovery.ts:24`, `src/lib/browser/recovery.ts:258`, `docs/decisions/2c-4c-2-notes.md:210`

The step brief says never to name or describe this product as *Duplicate*, *exact
copy*, or *Keep my draft*. The module header nevertheless introduces recovery by
comparison with *Keep my draft* and devotes a paragraph to all three names; the
choice documentation repeats one of them. The decision record then makes the
absolute claim that nothing in the module, tests, or record calls it any of those
names while itself repeating all three and while the cited module text is still
present.

Negating a reserved label is still using it to describe the recovery product,
and the absolute sweep claim is demonstrably false. The affirmative preservation
disclosure already says everything needed: this creates a new snippet from six
projected values and does not carry comments, unknown keys, key order, scalar
spelling/quoting, tags, or anchors.

**Minimal fix:** remove the three reserved names from the recovery module and
step record. Use only *Create a new snippet from supported fields* plus the
affirmative list of carried and omitted material; narrow the record to a claim
its actual text satisfies.

## Confirmed properties

Before this requested review file was added, the scoped implementation tree
contained exactly the four files named by the review request: new
`src/lib/browser/recovery.ts`, new
`src/lib/browser/recovery.test.ts`, modified
`src/lib/browser/workspace.test.ts`, and new
`docs/decisions/2c-4c-2-notes.md`; the record itself lists the same source/test
scope at `docs/decisions/2c-4c-2-notes.md:21` and confirms no component, i18n,
command, or Rust change at `docs/decisions/2c-4c-2-notes.md:27`.

The six field transfers correctly distinguish an absent optional from a present
empty string (`src/lib/browser/recovery.ts:572`,
`src/lib/browser/recovery.ts:687`), the destination list uses the conflict's disk
projection for its own document and does not synthesize a sequence
(`src/lib/browser/recovery.ts:359`), and the only placement value produced is
fixed `{ End: {} }` (`src/lib/browser/recovery.ts:705`,
`src/lib/browser/recovery.ts:1355`). A known committed save remains a saved
outcome when adoption fails, with `windowOutOfStep` beside it
(`src/lib/browser/recovery.ts:1366`, `src/lib/browser/recovery.ts:1394`). The
targeted recovery/workspace suite passes 211 tests, and `npm run check` reports
420 files with zero errors and zero warnings.

READINESS: NOT READY — blocked by Findings 1, 2, 3, 4, and 5.

## Confirmation pass — round 2

### 1. High — The two new adoption paths move the window while the source conflict still reports `retained`

**Location:** `src/lib/browser/recovery.ts:1052`, `src/lib/browser/recovery.ts:1807`, `src/lib/browser/recovery.ts:1825`, `src/lib/browser/recovery.ts:1905`, `src/lib/browser/recovery.ts:1935`, `src/lib/browser/recovery.test.ts:1194`, `docs/decisions/2c-4c-2-notes.md:220`

The callback-answer derivation is sound for `BrowserState.createMatch`: on the
failed arm `mayHaveWritten` is exactly the branch that re-reads the file
(`src/lib/browser/workspace.svelte.ts:2351`), while on the answered arm every
create reconciliation changes `adoption` from `notOwed`
(`src/lib/browser/workspace.svelte.ts:2360`,
`src/lib/browser/workspace.svelte.ts:2367`). `windowMoved` itself correctly
claims uncertainty rather than either a definite movement or a refusal
(`src/lib/browser/recovery.ts:1069`).

The sweep fails immediately outside that callback, however. The new reload
transition spends an adoption and closes by spreading the old session without
setting `windowWasReconciled` (`src/lib/browser/recovery.ts:1807`,
`src/lib/browser/recovery.ts:1817`); the new reapply transition likewise calls
`adoptForReapply` and returns a rebuilt session whose spread preserves the old
flag (`src/lib/browser/recovery.ts:1919`, `src/lib/browser/recovery.ts:1935`). A
successful production adoption installs the projection and advances its
generation (`src/lib/browser/workspace.svelte.ts:1831`,
`src/lib/browser/workspace.svelte.ts:1837`), so `sourceConflictState` can no
longer honestly answer `retained`. The reload test pins that false answer
explicitly (`src/lib/browser/recovery.test.ts:1194`), and the record's claim that
adopting only this form's conflict leaves the source conflict “unaffected”
conflates not spending `origin.conflict` with not invalidating the window it was
registered against (`docs/decisions/2c-4c-2-notes.md:220`). This is the same
defect class as round 1's Finding 1, in the narrower paths introduced to close
Findings 2 and 3.

### 2. Low — A closed form still accepts a focus transition

**Location:** `src/lib/browser/recovery.ts:840`, `src/lib/browser/recovery.ts:1273`, `src/lib/browser/recovery.ts:1825`, `src/lib/browser/recovery.test.ts:1185`

The reload transition marks the form closed, and the refusal/create/edit gates
do stop substantive edits and writes (`src/lib/browser/recovery.ts:1126`,
`src/lib/browser/recovery.ts:1358`). But `focusRecoveryField` has no closed or
editability guard and returns a changed session whenever the focus value differs
(`src/lib/browser/recovery.ts:1277`). Thus an ordinary late focus/blur event can
still drive a session after the new terminal state says the person has left it
behind. The closed-form test checks the refusal and create gate only
(`src/lib/browser/recovery.test.ts:1188`) and cannot catch this transition.

## Original finding dispositions

**F1 — NOT CLOSED.** The create-answer arms now produce the conservative three-valued answer (`src/lib/browser/recovery.ts:1513`, `src/lib/browser/recovery.ts:1583`), but both newly added successful adoptions preserve a false `windowWasReconciled` (`src/lib/browser/recovery.ts:1817`, `src/lib/browser/recovery.ts:1919`), and the record repeats the narrower false claim (`docs/decisions/2c-4c-2-notes.md:220`).

**F2 — CLOSED.** `reapplySupport: 'supported'` now has the real, typed `reapplyRecoveryToDiskVersion` transition behind it (`src/lib/browser/recovery.ts:1865`, `src/lib/browser/recovery.ts:1901`, `src/lib/browser/recovery.ts:2000`); it reads only `recoveryConflictOf(session)` (`src/lib/browser/recovery.ts:1905`) and remains unoffered (`src/lib/browser/recovery.ts:1999`). Building it was justified by the existing capability contract rather than an over-reach, although its source-conflict accounting is Finding 1 above.

**F3 — CLOSED.** The two-step reload exists and closes only after a satisfied spend (`src/lib/browser/recovery.ts:1760`, `src/lib/browser/recovery.ts:1775`, `src/lib/browser/recovery.ts:1807`, `src/lib/browser/recovery.ts:1825`), reapply retargets the draft to the conflict's disk revision and withdraws consent (`src/lib/browser/recovery.ts:1921`), and `keepRecovering` clears every stale reload step (`src/lib/browser/recovery.ts:1631`). Both transitions receive this form's own `conflictArm`, never `origin.conflict` (`src/lib/browser/recovery.ts:1109`), and the production adoption boundary refuses a confirmation spent twice (`src/lib/browser/workspace.svelte.ts:1792`). The original absent-path/stale-base defect is closed; Finding 1 is a new interaction with those paths.

**F4 — CLOSED.** The refusal test's callback is demonstrably reachable because the same mock is called once after the refusal is removed (`src/lib/browser/recovery.test.ts:1377`), the real-state version likewise observes zero then one `commands.createMatch` call (`src/lib/browser/workspace.test.ts:5044`), and the dependency scan has positive controls for both a command-layer import and direct `invoke` (`src/lib/browser/recovery.test.ts:1390`). These assertions are falsifiable rather than untouched-mock checks.

**F5 — CLOSED.** The module now describes the product affirmatively through the six carried values and omitted material (`src/lib/browser/recovery.ts:25`), while the record narrows its sweep to its own text and the module (`docs/decisions/2c-4c-2-notes.md:253`, `docs/decisions/2c-4c-2-notes.md:263`). The reserved product names do not remain in those artifacts; `PROGRESS.md` is outside this fix scope as directed.

The widened transitions otherwise preserve the standing bounds: recovery builds only a `NewMatch` from the six supported fields (`src/lib/browser/recovery.ts:716`), sends the single fixed `End` position (`src/lib/browser/recovery.ts:750`, `src/lib/browser/recovery.ts:1465`), and reaches writing only through the supplied create callback (`src/lib/browser/recovery.ts:1726`). A committed answer remains a saved outcome even when its adoption reports failure (`src/lib/browser/recovery.ts:1505`, `src/lib/browser/recovery.ts:1532`), and the repeated-literal-trigger comment claims risk and no espanso semantics (`src/lib/browser/recovery.ts:1595`). The targeted recovery/workspace run passes 229 tests and `npm run check` reports 420 files with zero errors and warnings.

Repository status confirms that the implementation/record changes are confined to `src/lib/browser/recovery.ts`, `src/lib/browser/recovery.test.ts`, `src/lib/browser/workspace.test.ts`, and `docs/decisions/2c-4c-2-notes.md`; no `.svelte`, i18n, Rust, `PROGRESS.md`, or `ConflictChoice` change is present. The record's matching scope statement is at `docs/decisions/2c-4c-2-notes.md:21` and its no-component/i18n/command/Rust statement at `docs/decisions/2c-4c-2-notes.md:27`.

READINESS: NOT READY — original Finding 1 is not closed, and confirmation Finding 2 is new.

## Round 3 — scoped pass over the fix round

**Provenance, and the bound on this section.** This round was dispatched read-only, so Codex could
not append its own section — the job reports *"Append was blocked because the workspace is mounted
read-only"* — and a second job commissioned solely to write it failed the same way. What follows is
the orchestrator's transcription of the job's **final message, verbatim**. Codex's fuller reasoning
for these dispositions was produced inside the job and **is not recoverable here**; the thread is
`019ff5bf-e4cb-7e50-bd13-51fc97ab1d02` and the rollout jsonl under `~/.codex/sessions/` is the only
place it survives. Rounds 1 and 2 above are Codex's own text; this section is not, and the
difference is recorded rather than smoothed over.

The pass was scoped to the fix round that answered round 2, and asked six questions: whether
confirmation F1 was closed at all three carriers, whether recording `windowWasReconciled` on
`alreadyThere` over-claims, whether the `closed`-versus-`isRecoveryEditable` distinction is right
and the transition-invariant test real, whether the two deliberate non-widenings are defensible, a
narrower-instance sweep against the shape the code now has, and whether round 3 disturbed what
round 2 confirmed closed.

Verbatim:

```
READINESS: NOT READY

Confirmation F1 — NOT CLOSED.

Confirmation F2 — NOT CLOSED.

Finding 1 (Medium) — `alreadyThere` is conservatively recorded, but contracts falsely claim a
definite install/movement (`src/lib/browser/recovery.ts:878`, `docs/decisions/2c-4c-2-notes.md:241`).

Finding 2 (Low) — the invariant test omits `recoveryCreateCouldNotBeSent`, which mutates a closed
form (`src/lib/browser/recovery.test.ts:1246`, `src/lib/browser/recovery.ts:1608`).

Append was blocked because the workspace is mounted read-only.
```

**What the two findings mean, as the fix round was briefed on them.** Finding 1 accepts the
behaviour and rejects the prose: recording conservatively on `alreadyThere` is sound, and the
argument that `windowMoved` claims uncertainty was accepted — but the contract and the record state
a **definite** install or movement, which is exactly what conservative recording means the code does
not know. Finding 2 is the hole the round was asked to look for: there is a **sixteenth** public
transition, `recoveryCreateCouldNotBeSent` mutates a closed form, and the fifteen-transition
invariant case does not enumerate it, so the property generalizing confirmation F2 has a gap where
that finding lived.

READINESS: NOT READY — confirmation F1 and confirmation F2 both remain open, on one Medium and one
Low respectively.

## Round 4 — scoped pass over the second fix round

**Provenance.** The workspace was again mounted read-only, so this round was asked to return its
full section in its final message rather than append it; what follows is that text, transcribed
verbatim by the orchestrator. Codex thread `019ff5cb-f7b7-73c1-803c-6d73dbb4a381`. Unlike round 3
above, nothing is lost — the section was written in full and only the writing was delegated.

### 1. Medium — The outcome-language sweep is incomplete

**Location:** `src/lib/browser/recovery.ts:71`, `src/lib/browser/recovery.ts:1096`, `src/lib/browser/recovery.ts:1523`, `src/lib/browser/recovery.ts:1560`, `src/lib/browser/recovery.ts:1605`, `src/lib/browser/recovery.ts:1777`, `docs/decisions/2c-4c-2-notes.md:146`

The new field contract is correct: `windowWasReconciled` means an adoption was spent or a re-read was ordered, while this module cannot determine whether the projection changed (`src/lib/browser/recovery.ts:884`). The four producers also record that conservative fact correctly (`src/lib/browser/recovery.ts:871`).

Several surrounding carriers still assert the outcome that the corrected contract disclaims:

- The header says spending either adoption "still moves the window" (`src/lib/browser/recovery.ts:71`).
- The `windowMoved` arm says the two adoptions "install a projection here just as surely" and that the window "is not where it was" (`src/lib/browser/recovery.ts:1106`, `src/lib/browser/recovery.ts:1119`).
- `applyRecoveryCreate` says a non-`notOwed` answer means the wrapper "installed whatever it read back" (`src/lib/browser/recovery.ts:1523`) and repeats that anything else means it "installed the projection and repaired the selection" (`src/lib/browser/recovery.ts:1560`).
- `recoveryCreateCouldNotBeSent` says the re-read "installs what comes back" (`src/lib/browser/recovery.ts:1605`).
- `sendRecoveryCreate` says the wrapper "installs what it reads back whenever" reconciliation is ordered (`src/lib/browser/recovery.ts:1777`).
- The decision record likewise says both create branches "order a re-read of the file and install what comes back" (`docs/decisions/2c-4c-2-notes.md:146`).

These are precisely the definite installed/moved outcomes that `alreadyThere`, failed reads, and the coarse callback answer prevent this module from knowing. The later qualified explanations of `installed` versus `alreadyThere` are legitimate contrasts, but they do not repair these absolute sentences.

**Minimal fix:** change each absolute carrier to the observable act: the adoption was spent or the wrapper ordered a re-read; therefore the projection may have changed and the source conflict can no longer be called intact. Keep `installed` only when contrasting the collapsed outcomes and explicitly preserve the uncertainty.

### 2. Low — The export partition is structural, but the terminal invariant still depends on one friendly fixture

**Location:** `src/lib/browser/recovery.test.ts:1062`, `src/lib/browser/recovery.test.ts:1134`, `src/lib/browser/recovery.test.ts:1373`, `src/lib/browser/recovery.test.ts:1400`, `src/lib/browser/recovery.ts:1667`, `src/lib/browser/recovery.ts:1830`, `src/lib/browser/recovery.ts:1845`, `src/lib/browser/recovery.ts:1889`, `src/lib/browser/recovery.ts:2001`, `docs/decisions/2c-4c-2-notes.md:386`

The sorted partition does what it claims for runtime value exports: a new runtime export is present in `Object.keys(recovery)` and fails until classified, while a duplicate classification also changes the sorted left side and fails (`src/lib/browser/recovery.test.ts:1381`). Type-only exports do not appear there, but they cannot themselves be form transitions.

Misclassification is not the only hole, however. Every probe receives the same closed session produced by the reload transition, whose outcome, submission, and reload state were cleared during closure (`src/lib/browser/recovery.test.ts:1400`, `src/lib/browser/recovery.ts:1903`). The test therefore cannot distinguish an explicit terminal guard from identity caused by that particular fixture.

The public `RecoverySession` shape does not encode "closed implies cleared outcome/reload," yet several transitions still omit a `closed` guard: `acknowledgeRecoveryFindings` (`src/lib/browser/recovery.ts:1667`), both confirmation-building transitions (`src/lib/browser/recovery.ts:1830`, `src/lib/browser/recovery.ts:1845`), the reload spend (`src/lib/browser/recovery.ts:1889`), and reapply (`src/lib/browser/recovery.ts:2001`). A type-valid closed session retaining the corresponding refusal, conflict, or reload step can therefore be changed, can answer a non-identity result, or can reach an adoption. This is the same coincidence class that correctly caused `applyRecoveryCreate` to gain its explicit guard.

The stated limitation also is not literally in the same sentence as what the test forces: both the test commentary (`src/lib/browser/recovery.test.ts:1381`) and §4.7 (`docs/decisions/2c-4c-2-notes.md:388`) state the force and the limitation in consecutive sentences.

**Minimal fix:** put `closed` guards on every remaining transition before it reads outcome, reload, or acknowledgement state, and probe at least one adversarial type-valid closed form retaining those fields. State in one sentence that the partition forces every runtime export name to be classified, but cannot force correct classification or sufficient probe inputs.

**Round 3 Finding 1 — NOT CLOSED.** The recording itself remains sound and its field contract now accurately states the act/uncertainty distinction (`src/lib/browser/recovery.ts:884`), but the header, variant documentation, create-answer documentation, send documentation, and decision record still assert definite installation or movement as detailed in Finding 1.

**Round 3 Finding 2 — CLOSED.** `recoveryCreateCouldNotBeSent` now checks `closed` before changing any state (`src/lib/browser/recovery.ts:1633`). `applyRecoveryCreate` also checks `closed` before its otherwise coincidental `submitted === null` exit (`src/lib/browser/recovery.ts:1548`); that check is correct because closure is the terminal contract, independently of the current closure producer clearing the submission.

Removing the transition counts was the right call. The authoritative property is the named runtime-export partition (`src/lib/browser/recovery.test.ts:1062`, `src/lib/browser/recovery.test.ts:1134`), not an ambiguous ordinal that changes according to whether queries, non-identity answers, or type-only exports are counted.

The fix round did not alter the F2/F3 mechanics it inherited. Reload still spends the confirmed adoption before changing the form and returns unchanged/refused before closure (`src/lib/browser/recovery.ts:1893`); reapply still decides and rebuilds before spending its adoption, with refusal returning first (`src/lib/browser/recovery.ts:2005`, `src/lib/browser/recovery.ts:2031`); the obstacle union remains intact (`src/lib/browser/recovery.ts:1926`); and the capability record remains supported but unoffered (`src/lib/browser/recovery.ts:2098`). The fixed `End` position remains the sole placement (`src/lib/browser/recovery.ts:755`), every write still goes through the supplied callback (`src/lib/browser/recovery.ts:1804`), and a committed write remains a saved outcome even when adoption fails (`src/lib/browser/recovery.ts:1530`).

READINESS: NOT READY
