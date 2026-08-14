# Phase 2c-5-3 adversarial code review

## Verdict

Changes requested. The retained candidate is passed to the sender without text transformation, the target base revision is not refreshed inside `sendRestore`, conflict adoption treats `alreadyThere` as success, `committed: false` remains a success, and the shared `saveOutcome.ts` change leaves the six existing write surfaces on their prior `reseedsDraft`/`closesSurface` behavior. However, the confirmed value is reusable and detached from the state it authorized, so the Q8 binding is not actually one-shot or rechecked at send time. There are also post-confirmation state and invalidation gaps that step 4 cannot safely paper over.

The requested gates were not rerun. `docs/decisions/2a-3b-notes.md` was ignored.

## High

### H1 — Behavioral defect: a confirmed restore can be sent repeatedly or after its five bindings have changed

- **Files and lines:** `src/lib/browser/restore.ts:1095-1110`, `src/lib/browser/restore.ts:1152-1189`, `src/lib/browser/restore.ts:1259-1272`; the contradicted claims are at `src/lib/browser/restore.ts:2-3`, `src/lib/browser/restore.ts:22-28`, `src/lib/browser/restore.test.ts:625`, `docs/decisions/2c-5-3-notes.md:24`, and `docs/decisions/2c-5-3-notes.md:48-53`.
- **Exact defective expression:** `sendRestore` accepts an already-produced `StartedRestore` and unconditionally calls `send(...)`; `StartedRestore` carries only `document` and `submission`, not the bound entry identity, candidate revision, or preview generation, and there is no spent-token registry or current-session/context argument.
- **Exact defective claims:** “the one-shot confirmation”; “a preview of entry A followed by a write of entry B is not a state this module can reach”; and the test name “is the only thing that produces something to send.”
- **Why it is wrong:** `confirmRestore` consumes `pending` only in `started.session`. It does not consume the `StartedRestore` object. Calling `sendRestore(started, send)` twice issues two saves. More seriously, a caller can confirm entry A, move the live session to entry B, another target/base/generation, or new open-surface state, and later pass the old `started` to `sendRestore`; the send performs no recheck and writes A under the old authorization. This is exactly Q8's destructive failure mode: the confirmation can be carried past a changed preview/target state, and its supposedly unspent status plus all five bound values are not checked at send time.
- **Concrete fix:** make sending atomically validate and spend a private runtime permit. The permit must retain all five bound values and the exact candidate, `sendRestore` must take the current `RestoreSession` and live `RestoreContext`, recheck document, base revision, entry identity, candidate revision, preview generation, observed revision, and competing surfaces, and mark the permit spent synchronously before calling `BrowserState.saveRawDocument`. A private `WeakSet`/`WeakMap` keyed by the confirmed object is sufficient for one-shot runtime spend, or confirmation and send can be collapsed into one exported transition that has no reusable intermediate value. Add tests that reuse the same confirmed object and that change each binding/open-surface observation between confirmation and send; every such path must call the sender zero times. Correct the header, test name, and decision record to match the implemented guarantee.

No other High finding was found.

## Medium

### M1 — Behavioral defect: editing transitions remain live during the send and can hide or misdescribe a committed answer

- **Files and lines:** `src/lib/browser/restore.ts:768-957`, especially `chooseBatch` at 807-814, `chooseEntry` at 864-866, and `candidateRead` at 888-910; `applyRestore` at 1307-1353; the contradicted user-facing claim is `src/lib/i18n/en.json:482` and `src/lib/i18n/es.json:482`.
- **Exact defective expressions:** the catalogue/selection/candidate transitions contain no `session.phase === 'saving'` guard, while `applyRestore` begins with `if (submission === null || preview === null) { return session; }` and otherwise describes the answer with the current `preview.draft`.
- **Exact defective sentence:** “This replacement is being written, so nothing can be changed here until the file answers.” / “Esta sustitución se está escribiendo, así que aquí no se puede cambiar nada hasta que responda el archivo.”
- **Why it is wrong:** after `confirmRestore` returns a `session` in phase `saving`, `chooseBatch`, `chooseEntry`, `candidateRead`, `candidateRefused`, catalogue refreshes, and `targetRevisionObserved` can still change it. Dropping the preview makes `applyRestore` return without opening the one-shot seal, even if the file committed. Replacing the preview makes an answer for submitted candidate A be described against candidate B. Thus the model does not provide the in-flight immutability its sentence claims, and a committed result can be stranded rather than reported.
- **Concrete fix:** make every selection/catalogue/candidate/base transition a no-op while `phase === 'saving'` (and after a committed restore where applicable). Also retain the submitted preview/snapshot as part of the in-flight state and make `applyRestore` open and classify the seal from that frozen submission, never from the mutable current preview; absence of presentation state must not prevent a committed seal from being discharged. Add cases for every public mutation while saving and for a committed answer after the preview was removed or replaced.

### M2 — Behavioral defect: the restore consumes the whole-document invalidation without giving the coordinator a way to close or terminalize competing surfaces

- **Files and lines:** `src/lib/browser/restore.ts:1307-1321`; specification at `docs/reviews/phase-2c-5-design.md:68-70`.
- **Exact defective expression:** `openWholeDocumentSave(sealed, (invalidation) => { replaced.revision = invalidation.revision; })`.
- **Why it is wrong:** the callback merely copies a revision. `BrowserState.saveRawDocument`'s issuer invalidation drops/reprojects workspace caches, but it does not own the match editor, creator, deleter, mover, duplicator, raw-editor, or restore sessions. Q4 explicitly treats the pre-send open-surface refusal as an affordance, because a surface can open after confirmation, and requires committed whole-document invalidation to close or mark terminal every surface for that document. Since `applyRestore` hides `openWholeDocumentSave` and accepts no coordinator callback, step 4 has no way to discharge that obligation through the sealed protocol. A newly opened surface can therefore survive the commit with an identity or operation minted from replaced bytes.
- **Concrete fix:** require `applyRestore` to receive the coordinator's synchronous whole-document invalidator and invoke it from the `openWholeDocumentSave` callback (while also recording the revision). The callback must close/terminalize every write surface for `invalidation.document`; if it throws, retain the committed outcome and add `windowOutOfStep` beside it. Add a model test in which a surface opens after confirmation and is terminalized on commit, plus a throwing-callback test proving the committed arm remains primary.

### M3 — Claim defect: the target-moved refusal claims no send even though its predicate does not establish that

- **Files and lines:** `src/lib/i18n/en.json:481`, `src/lib/i18n/es.json:481`; predicate at `src/lib/browser/restore.ts:1013-1014`.
- **Exact defective sentence:** “Nothing was sent to the file by this attempt.” / “Este intento no ha enviado nada al archivo.”
- **Why it is wrong:** `targetMoved` means only that `context.observed` is null or differs from `session.baseRevision`. The same predicate is reachable after a previous send, including an uncertain `mayHaveWritten` answer or a `committed: false` success followed by another projection change. It does not prove that no command was sent. This is the named defect class: the refusal sentence asserts more than its predicate.
- **Concrete fix:** remove the historical send claim. Say only that the replacement cannot be prepared or confirmed against the reading the window now holds and must be set up again. Make the equivalent change in Spanish.

## Low

### L1 — Claim defect: the model and record claim the retained bytes are still in the backup entry

- **Files and lines:** `src/lib/browser/restore.ts:580-583`; `docs/decisions/2c-5-3-notes.md:210-212`.
- **Exact defective sentence:** “it is a backup entry's exact bytes, still in the entry and still retained here.”
- **Why it is wrong:** the catalogue is untrusted and mutable, and the design deliberately reads an entry once rather than revalidating it at send time. The model knows that the retained text was read from the entry; it cannot know that the entry still exists or still contains those bytes. “Still in the entry” is an unsupported current-provenance claim.
- **Concrete fix:** replace it with “it is the exact text read from a backup entry and retained here,” and explicitly avoid any claim about what the entry holds now. Apply the same correction to the decision record.

### L2 — Claim defect: the already-opened branch says it leaves the session alone but changes its phase

- **Files and lines:** `src/lib/browser/restore.ts:1299-1301`, `src/lib/browser/restore.ts:1322-1324`; `docs/decisions/2c-5-3-notes.md:275-278`.
- **Exact defective sentence:** “this answers by leaving the session alone” / “a second open of the same seal leaves the session alone.”
- **Why it is wrong:** the branch returns `{ ...session, phase: 'editing' }`. That is a deliberate and probably useful state change, but it is not leaving the session alone.
- **Concrete fix:** keep the behavior and narrow both claims to “does not invent or replace an outcome and returns the session to `editing`,” then make the test name/assertion use that predicate.

## Shared-module regression audit

No finding. `reloadWarningFor` preserves the old mapping exactly: `reseedsDraft` still yields `reloadDiscardsDraft`, and `closesSurface` still delegates by `draftKind` to `reloadClosesSurface` or `reloadAbandonsOperation`. The match editor, creator, deleter, mover, and duplicator still declare `closesSurface`; the raw editor still declares `reseedsDraft`. The new `retargetsCandidate` arm is exhaustive rather than a changed default. The added `ConflictOperation` member and translation mapping do not alter the prior six surfaces.

## English/Spanish meaning audit

Apart from M3, the new English and Spanish entries have equivalent operative meaning. The six open-surface refusals state that a surface is open and must be closed; neither language asserts that the coordinator observed dirty state. The shared conflict sentence keeps the candidate, leaves the panel open, withdraws confirmation, and says the conflict/reload path writes nothing in both languages. No new string claims chronology, authenticity, recoverability, validity, provenance, or undo.

## Accessor judgment

The step's arrangement is sound at this boundary, not a hole in the completed step. Nothing in 2c-5-3 renders a restore code, and `restoreRefusalKey`/`openWriteSurfaceKey` already return `TranslationKey`, so a missing dictionary key is a compile error where the mapping is defined. Adding a reactive accessor now would make the otherwise-unreachable restore model reachable from the application entry solely for code that no component calls. Step 4 must add a typed `tRestoreRefusal(refusal: RestoreRefusal)` accessor in `src/lib/i18n/index.ts` and the component must call that accessor, not `t(restoreRefusalKey(...))` or construct a key. At that point the component itself necessarily makes the restore model reachable, so the current bundle argument disappears and the CLAUDE.md accessor rule applies in full.
