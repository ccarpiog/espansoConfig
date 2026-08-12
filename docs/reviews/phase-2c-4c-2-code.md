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

---

## Round 5 — scoped pass over the third fix round

**Provenance.** The workspace was mounted read-only for a third consecutive round, so this round was
asked up front to return its full section in its final message rather than append it; what follows is
that text, transcribed verbatim by the orchestrator. Codex job `task-msqcn0ge-09nyil`, thread
`019ff6f7-d932-7101-bf6d-309c54a025d2`. As with round 4 and unlike round 3, nothing is lost — the
section was written in full and only the writing was delegated. The round could not run the targeted
Vitest file, because Vite could not create `node_modules/.vite-temp/` under the read-only mount; it is
therefore a reading pass, and the orchestrator re-derived the four gates on the tree instead.

**Verdict: NOT READY.**

### 1. Medium — The outcome-language sweep again leaves narrower claims that the window definitely moved or the projection was installed

**Defect.** Although the corrected contract says only that an adoption was spent or a re-read was ordered, the field summary, implementation comments, test names/comments and evidence record still assert definite movement, installation or repair.

**Location:** `src/lib/browser/recovery.ts:867`, `src/lib/browser/recovery.ts:1563`; `src/lib/browser/recovery.test.ts:904`, `src/lib/browser/recovery.test.ts:1008`, `src/lib/browser/recovery.test.ts:1300`, `src/lib/browser/recovery.test.ts:1347`, `src/lib/browser/recovery.test.ts:1571`; `docs/decisions/2c-4c-2-notes.md:475`, `docs/decisions/2c-4c-2-notes.md:483`, `docs/decisions/2c-4c-2-notes.md:490`, `docs/decisions/2c-4c-2-notes.md:626`.

**Failure scenario:** an adoption answers `alreadyThere`, or an ordered re-read fails → `windowWasReconciled` correctly becomes `true` and `sourceConflictState` conservatively answers `windowMoved`, but no projection was installed and no movement or selection repair is known; nevertheless:

- the field summary says something “made the window move” (`recovery.ts:867`);
- `applyRecoveryCreate` says the wrapper ordered “a repair of the selection” (`recovery.ts:1565`);
- the uncertain-send comment says the wrapper “installs the projection and repairs the selection” (`recovery.test.ts:906`);
- the monotonicity case says the re-read moved the window (`recovery.test.ts:1008`, `recovery.test.ts:1020`);
- both `alreadyThere` case names say the window was moved (`recovery.test.ts:1300`, `recovery.test.ts:1347`);
- the view case says the conflict remains the person’s until commit, omitting the non-committed middle state (`recovery.test.ts:1571`);
- the evidence table repeats those claims (`2c-4c-2-notes.md:475`, `:483`, `:490`) while the round record incorrectly declares the sweep complete (`2c-4c-2-notes.md:626`).

Nothing imports this module from a `.svelte` file yet, so these claims are not currently presented in a window. That changes reachability, not the severity of a false contract or record.

### 2. Low — The terminal-invariant documentation describes the pre-fix guard and fixture shape rather than the code now present

**Defect.** The `closed` contract still says only four transitions have explicit guards, while the test commentary describes one combined hostile fixture and “three” non-identity doors although the fix contains nine explicit guards, four separate hostile fixtures and two non-identity probes.

**Location:** `src/lib/browser/recovery.ts:848`, `src/lib/browser/recovery.test.ts:1037`, `src/lib/browser/recovery.test.ts:1393`.

**Failure scenario:** a maintainer evaluates a type-valid closed session retaining a confirmed reload → the actual explicit guard at `src/lib/browser/recovery.ts:1922` prevents adoption, but the session contract says the transition is protected only through an existing gate (`src/lib/browser/recovery.ts:849`); meanwhile the test explanation says a single “second fixture” carries refusal, conflict, submission and confirmation (`src/lib/browser/recovery.test.ts:1402`), whereas those states are deliberately partitioned across four fixtures at `src/lib/browser/recovery.test.ts:1426`. The executable coverage is sound, but its contract is false.

### Fix rulings

1. **Seven reworded outcome-language carriers — NOT COMPLETE.** The seven named round-4 carriers were improved, and the core contract at `src/lib/browser/recovery.ts:885` correctly defines the observable act and uncertainty. The narrower carriers in Finding 1 remain. Do not disturb the deliberate recording of `alreadyThere` or the `windowMoved` variant; only the claims of definite movement, installation or repair need correction.

2. **Five new closed guards — COMPLETE, nothing further in behaviour.** Each guard precedes the relevant state read:

   - `acknowledgeRecoveryFindings` at `src/lib/browser/recovery.ts:1676`;
   - `askToReloadRecoveryDiskVersion` at `src/lib/browser/recovery.ts:1846`;
   - `confirmRecoveryDiskReload` at `src/lib/browser/recovery.ts:1868`;
   - `reloadRecoveryDiskVersion` at `src/lib/browser/recovery.ts:1922`;
   - `reapplyRecoveryToDiskVersion` at `src/lib/browser/recovery.ts:2042`.

   No other form transition reads outcome, reload or acknowledgement state before a terminal check or an existing closed-aware gate. Queries such as `recoveryConflictOf` and `recoveryView` are correctly classified as queries rather than transitions. The guards return only when `closed` is true, so they do not change any non-closed path. The stale contract described in Finding 2 should be corrected without changing these guards.

3. **Four hostile fixtures — COMPLETE, nothing further in executable coverage.** All four are type-valid because `RecoverySession` independently permits `closed`, `submitted`, `outcome` and `reload` (`src/lib/browser/recovery.ts:818`, `:820`, `:838`, `:857`). They cover distinct load-bearing states at `src/lib/browser/recovery.test.ts:1426`:

   - closed conflict at `idle` falsifies removal of the ask and reapply guards;
   - closed conflict at `confirming` falsifies removal of the confirmation guard;
   - closed conflict at `confirmed` falsifies removal of the reload-spend guard and reaches the adoption recorder;
   - closed refusal with its submission falsifies removal of the acknowledgement guard.

   Each fixture receives its own adoption recorder at `src/lib/browser/recovery.test.ts:1448`, and the zero-adoption assertion at `src/lib/browser/recovery.test.ts:1460` independently catches a closed form reaching the window. None duplicates the friendly fixture, whose outcome, submission and reload state were cleared during closure.

### Correct properties not to disturb

The `windowWasReconciled` contract at `src/lib/browser/recovery.ts:885` is correct: the flag records an adoption spent or re-read ordered, not an observed projection change. Its four producers remain correct at `src/lib/browser/recovery.ts:1568`, `src/lib/browser/recovery.ts:1649`, `src/lib/browser/recovery.ts:1946` and `src/lib/browser/recovery.ts:2082`. Recording both `installed` and `alreadyThere` is deliberately conservative and must remain.

The export partition at `src/lib/browser/recovery.test.ts:1388` correctly forces every runtime export name to be classified while explicitly acknowledging that classification correctness and probe strength are separate concerns. The five guards and hostile fixtures close the behavioural hole round 4 identified.

The targeted Vitest file could not start in this read-only mount because Vite attempted to create `node_modules/.vite-temp/...` and received `EPERM`; no repository files were modified.

---

## Round 6 — scoped pass over the fourth fix round

**Provenance.** Read-only mount again, so the section was requested in the final message and is
transcribed verbatim by the orchestrator. Codex job `task-msqdcstz-n9epi5`, thread
`019ff70a-3355-79e1-8afd-4d6a5819e79d`. This round was told READY was a legitimate and expected
outcome and that it must neither manufacture nor withhold a finding.

**Verdict: NOT READY.**

### 1. Medium — The outcome-language sweep still misses reload contracts that claim an adoption changed the window

**Defect.** The corrected `windowWasReconciled` contract permits a satisfied adoption to answer `alreadyThere`, but four production comments and the decision record still say the reload adopts the disk projection or crosses the window to it.

**Location:** `src/lib/browser/recovery.ts:842`, `src/lib/browser/recovery.ts:1888`, `src/lib/browser/recovery.ts:1892`, `src/lib/browser/recovery.ts:2131`; `docs/decisions/2c-4c-2-notes.md:230`.

**Failure scenario:** `reloadRecoveryDiskVersion` spends a confirmed reload and `BrowserState.adoptDiskVersion` answers `alreadyThere` → the projection was already present, so nothing is installed and the window crosses nowhere; nevertheless the `closed` field contract says the reload “adopts the disk projection,” the transition says it “adopts the disk version into the window” and “crosses to the disk observation,” the capability contract repeats the adoption claim, and D9 records the same false guarantee. The transition correctly closes the form and records uncertainty; only these descriptions overstate what happened.

Nothing imports this module from a `.svelte` file yet, so none of these claims is currently presented in a window. That changes reachability, not the severity of a false contract and decision record.

### Round 6 rulings

1. **Outcome-language sweep — NOT COMPLETE.** The fixer's narrower claim about the surviving literal words is substantively correct: projection-related uses of `installed`, `moved` and `repaired` are now hedged with *may*, explicitly contrasted with `alreadyThere`, negative, or about another value such as a destination or draft base. The remaining defect is the still narrower synonym in Finding 1: *adopts the disk projection* and *crosses to the disk observation* assert the same outcome without using the previous finding's words. Do not disturb the deliberate recording of `alreadyThere`, the `windowMoved` variant, or the authoritative field contract at `src/lib/browser/recovery.ts:876`.

2. **The thirteen reworded outcome carriers — COMPLETE, nothing further.** None introduces a new false claim or weakens a fact the code provides. They now distinguish an adoption spent or re-read ordered from an unknown projection or selection outcome. The renamed monotonicity and `alreadyThere` cases retain the precise cause they drive, and the evidence rows retain their specific observable assertions.

3. **Terminal invariant and guard count — COMPLETE, nothing further.** The count is exactly nine explicit transition guards: `focusRecoveryField`, `applyRecoveryCreate`, `recoveryCreateCouldNotBeSent`, `acknowledgeRecoveryFindings`, `keepRecovering`, `askToReloadRecoveryDiskVersion`, `confirmRecoveryDiskReload`, `reloadRecoveryDiskVersion` and `reapplyRecoveryToDiskVersion`. `recoveryRefusal` separately checks `closed` first and answers `formClosed`; describing that pre-existing query as the gate through which `beginRecoveryCreate` and therefore `sendRecoveryCreate` stop is accurate. Editing, undo, redo and destination selection stop through `isRecoveryEditable`. The corrected contract agrees with the code.

4. **Corrected test names and comments — COMPLETE, nothing further.** The renamed view case drives exactly `retained` before a send and `spent` after a committed create; its comment explicitly identifies the deliberately omitted non-committed `windowMoved` arm and points to the cases that drive it. The hostile-fixture case accurately describes four separate fixtures, and the adoption count accurately describes two probes. Inspection against Round 5's recorded executable rulings found no changed `expect(...)`, fixture value, guard or export; the changes are names, comments and contracts only.

5. **In-place decision-record correction — COMPLETE, nothing further.** The blockquote at `docs/decisions/2c-4c-2-notes.md:629` visibly preserves the former “sweep complete” claim, identifies the review-file round whose finding corrects it, explains the intentionally retained local ordinals, and records all thirteen repaired carriers. Its account of the nine guards and four hostile fixtures agrees with the implementation. Finding 1 is an older sentence elsewhere in the record that the correction's semantic sweep still failed to reach, not dishonesty in the correction block itself.

### Correct properties not to disturb

`windowWasReconciled` correctly means **an adoption was spent or a re-read was ordered**, never that a projection changed, the window moved, or the selection was repaired. Its four producers remain correct, including both satisfied adoption outcomes. `sourceConflictState` correctly uses `windowMoved` to express uncertainty, and `alreadyThere` must continue to record that uncertainty conservatively.

The nine explicit guards, `recoveryRefusal`'s `formClosed` gate, the exhaustive export partition, the produced closed fixture, the four hostile fixtures and their per-fixture adoption recorders are all correct. No executable change is warranted for this round's finding.

---

## Round 7 — scoped pass over the fifth fix round

**Provenance.** Read-only mount again; the section was requested in the final message and is
transcribed verbatim by the orchestrator. Codex job `task-msqdjldc-9pa4oj`, thread
`019ff70f-0952-79a0-b9de-4e0ba0a32f3d`.

**Verdict: NOT READY.**

### 1. Medium — The repaired capability contract now endorses a warning that still claims definite window movement

**Statement:** `RECOVERY_CONFLICT_CAPABILITIES` says its appended warning truthfully describes the transition, but that warning says loading the disk version “moves this window to it,” which is false when the satisfied adoption answers `alreadyThere`.

**Location:** `src/lib/browser/recovery.ts:2134`; `src/lib/i18n/en.json:161`; `src/lib/i18n/es.json:161`.

**Failure scenario:** `reloadRecoveryDiskVersion` spends the confirmed adoption and `BrowserState.adoptDiskVersion` answers `alreadyThere` → the form correctly closes and records `windowWasReconciled`, but the projection was already present and the window moved nowhere; nevertheless the warning selected by `reloadOutcome: 'closesSurface'` tells the person that loading the disk version moves the window to it. The Spanish sentence makes the same guarantee. This is the still-narrower outcome claim: it survives indirectly through the repaired contract’s assertion that the appended warning “describes something this value really does.”

Nothing imports `recovery.ts` from a `.svelte` file yet, so this recovery warning is not currently reachable from a window. That limits present reachability but does not reduce the seriousness of a false behavioral contract and future user-facing sentence.

### Round 7 rulings

1. **Still-narrower-instance sweep — NOT COMPLETE.** I read the scoped files by meaning, not by the literal vocabulary of rounds 5 and 6: claims about where the projection/window finishes, verbs describing acceptance or transfer to the disk observation, and indirect endorsements of other prose. The direct statements in `recovery.ts`, `recovery.test.ts` and §2.9/§5 of `2c-4c-2-notes.md` now consistently distinguish a spent adoption or ordered re-read from an observed projection change. The surviving instance is the capability contract’s semantic incorporation of the `reloadClosesSurface` warning, whose actual sentence still guarantees movement.

2. **“takes the disk version in two steps” — accurate act description, not a finding.** At `src/lib/browser/recovery.test.ts:1319`, “takes” names the person’s reload choice—ask, then confirm—and the resulting request to spend this form’s own adoption. It does not say that a projection was installed or that the window moved. The assertions separately establish one adoption call, closure, and the deliberately conservative `windowMoved` answer; the comment at lines 1341–1345 expressly says a satisfied spend does not reveal whether installation occurred. The citations at `docs/decisions/2c-4c-2-notes.md:485` and `:491` use that case name only as a test locator and state the asserted uncertainty correctly. Leave the name and those citations alone.

3. **“closes the form on that spend” — accurate, with the satisfied/refused distinction preserved.** `reloadRecoveryDiskVersion` returns unchanged for `notAttempted`; on `refused` it records `RELOAD_REFUSED` and leaves `closed` false; only the satisfied result—collapsing `installed` and `alreadyThere`—reaches `closed: true`. In the established contract vocabulary, an adoption was spent only on that satisfied path. The new doc comment explicitly names the satisfied result, and the notes bullet says a satisfied adoption may answer either way, so neither claims closure regardless of the adoption answer. No false claim or weakening was introduced there.

4. **Agreement among the repaired sites — incomplete only at the warning cross-reference.** The closed-field contract, the `reloadRecoveryDiskVersion` documentation, its implementation comment, and the §2.9 reload bullet agree that a satisfied adoption spend closes the form without establishing installation or movement. `reloadOutcome: 'closesSurface'` is also the correct capability: `draftKind: 'authoredText'` selects `reloadClosesSurface`, and the satisfied implementation clears the form state and closes it rather than reseeding a disk-side recovery draft. What is not correct is the contract’s additional assertion that the appended warning agrees with that behavior, because the warning adds the stronger “moves this window to it” guarantee.

### Correct properties not to disturb

`windowWasReconciled` remains correct as an intentionally coarse, monotonic record of an adoption spent or a re-read ordered. Both `installed` and `alreadyThere` must continue to set it after a satisfied adoption. `sourceConflictState` must continue to answer `windowMoved` as uncertainty rather than proof of movement.

The reload must continue to close only after a satisfied spend, remain open with `RELOAD_REFUSED` after refusal, clear the conflict/outcome state on closure, spend this recovery form’s own conflict rather than `origin.conflict`, and retain `reloadOutcome: 'closesSurface'`. The two-step test name and its decision-record citations are accurate and should not be changed.

This was a repository-reading pass only, as requested. No files were modified and no tests or build commands were run; the supplied four-gate and byte-identical-bundle evidence therefore remains the executable evidence for this prose-only fix.

### The orchestrator's two corrections to this round, neither of which changes its finding

**1. The sentence is not unreachable — it is shipped, in both languages, on two surfaces that have
already been window-read.** Round 7 rated present reachability from `recovery.ts` alone, and by that
measure it was right. But `browser.saveOutcome.reloadClosesSurface` is selected by
`saveOutcome.ts:795` from `draftKind: 'authoredText'`, which the **match editor** and the **match
creator** already produce: `MatchEditor.test.ts:1171` and `MatchCreator.test.ts:970` each assert the
message **is** drawn, and `MatchDeleter`, `MatchMover` and `MatchDuplicator` each assert it is not.
So this is a live user-facing sentence on shipped screens, not a latent one — which **raises** what
is at stake and simultaneously puts the sentence **outside step 2c-4c-2**, whose whole diff is prose
in three files and whose bundle is byte-identical.

**2. Whether the sentence is actually false is genuinely contested, and the record should not assert
it.** `alreadyThere` is returned when a reprojection has **already reached the requested revision** —
so in that arm the window *is* showing the disk version; it simply did not have to move to get there.
Read as a promise about **movement**, the sentence is false in that arm and round 7 is right. Read as
a promise about **where the person ends up**, it holds in both arms. This project has no ruling on
which reading a warning makes, and picking one here would decide it by momentum.

**Disposition.** The in-scope half was fixed: `recovery.ts` no longer **endorses** the warning as
describing what this value does, and now vouches only for the closing and for nothing being seeded,
naming the unvouched clause and the reason. The dictionary sentence itself goes to `PROGRESS.md`'s
standing debt ledger with both readings recorded, by the established precedent that changing a
user-facing sentence on a shipped screen obliges a **re-taken window reading** of the sub-phase that
owns it — here 2c-4a-3c. That is an owner-visible deferral, not a silent one.
