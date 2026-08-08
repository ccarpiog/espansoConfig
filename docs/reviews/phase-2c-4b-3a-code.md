NOT READY

## Findings

### High — `src/lib/i18n/en.json:140` and `src/lib/i18n/es.json:140`: the readiness sentences promise a sendable form even for the no-op result

The English authored-text sentence says, **“If it can, what you get back is a form to send”**, and the operation sentence at `en.json:141` says, **“If it can, the action is set up again over that version for you to send.”** The Spanish clauses at `es.json:140-141` make the same claims. Those conclusions do not follow from safe correspondence. `matchEditor.reapplyToDiskVersion` and `matchMove.reapplyToDiskVersion` can answer `alreadySatisfied`: the newly parsed disk version already contains the requested result, so the rebuilt session has nothing to send. The mounted mover suite even exercises that arm. This is exactly Q6's prohibited class of guarantee: successful correspondence does not imply that the retained intent is reapplied into a new pending save.

Fix both readiness keys so they name both permitted successful outcomes. Suggested English sentences:

- `browser.reapply.ready`: “espansoConfig will try to apply the changes you kept to the version of this file on disk shown above, working from that newly parsed document. Nothing is written if the snippet this change is about, or any field you changed, cannot be matched safely. If they can be matched safely, espansoConfig will either report that the disk version already contains the requested changes or return a form for you to send; any later save can still be refused or conflict again.”
- `browser.reapply.readyOperation`: “espansoConfig will try to apply the requested action to the version of this file on disk shown above, working from that newly parsed document. Nothing is written if the target needed for that requested action, including any required position, cannot be matched safely. If it can be matched safely, espansoConfig will either report that the disk version already contains the requested result or set the requested action up for you to send; any later save can still be refused or conflict again.”

Translate those same predicates into Spanish; do not preserve the unconditional “formulario por enviar” / “para que la envíe” conclusion.

### Medium — `src/lib/i18n/en.json:142-145` and `src/lib/i18n/es.json:142-145`: the result prose overstates what the adoption predicate proves

The `reapplied` and `alreadySatisfied` strings say **“espansoConfig moved this window to the version on disk”** (Spanish: **“ha llevado esta ventana a la versión en disco”**). A successful reapply may receive `DiskAdoptionOutcome = 'alreadyThere'`; in that arm this click installs nothing because the window already held the requested revision. The predicate proves the window now holds that revision, not that this attempt moved it.

The `adoptionRefused` string also says **“Asking again about this same conflict cannot change that answer”** (Spanish: **“Volver a preguntarlo por este mismo conflicto no puede cambiar esa respuesta”**). A generation-mismatch refusal spends nothing. If the live projection later reaches the conflict's disk revision, the same unspent authorization can be answered `alreadyThere`; more generally, `adoptionRefused` does not encode a permanent cause. The sentence therefore claims permanence that the outcome does not carry.

Fix the English result sentences to say:

- `browser.reapply.reapplied`: “This window now shows the version on disk, with what you kept set up over it. Nothing has been written yet: send it when you are ready, and that save can still be refused or conflict.”
- `browser.reapply.alreadySatisfied`: “This window now shows the version on disk, and that version already holds what you asked for, so there is nothing left to send. Nothing was written.”
- `browser.reapply.adoptionRefused`: “This window would not move to the version on disk, so nothing was rebuilt and nothing was written. What you kept is still here. Keep editing, or close this and open the file again to start from what it holds now.”

Make the equivalent predicate-preserving corrections in Spanish.

### Low — `src/lib/browser/matchEditor.ts:1678`: the swept adoption contracts still present an incomplete refusal list

The rewritten passage says a refusal is **“a spent confirmation, a conflict this window did not produce, or a projection replaced since it arrived…”** as though those were the possible window refusals. It omits a confirmation issued for another conflict and an unprojected document. The same incomplete list remains at `matchCreation.ts:1339`, `matchDeletion.ts:770`, `matchDuplication.ts:1043`, and `matchMove.ts:1587`. `rawEditor.ts:841` includes the wrong-conflict case but still omits the unprojected-document case; `reapply.ts:239` includes the unprojected case but omits a confirmation issued for another conflict. This is the narrower survivor the requested guard-order sweep was meant to catch, and it contradicts the exhaustive sequence correctly written in `editorSave.ts:369` and `workspace.svelte.ts:615`.

Fix every passage to use the same ordered description: “a confirmation issued for another conflict, one already spent, a conflict this window did not produce, an unprojected document, or a projection replaced since the conflict arrived when the window does not already hold the requested revision.” Keep the qualification that `alreadyThere` is decided before the generation comparison.

### Low — `src/lib/components/RawEditor.test.ts:1102`: the new test comment contradicts the two-gate rule it tests

The comment says **“only the second is what the producer requires.”** `conflictChoicesFor` requires both `offersReapply` and `reapplySupport === 'supported'`. The assertions below correctly prove that the permanent support gate cannot be bypassed by flipping the boolean, but the comment describes a one-gate producer and conflicts with Q6 and the production implementation.

Fix the sentence to: “`offersReapply` says what the surface draws today and `reapplySupport` says what it can ever do; the producer requires both, and the second is why flipping the raw editor's boolean alone still offers nothing.”

## Categories with no additional finding

- **Choice authority:** `keepMyDraft` is produced only by `conflictChoicesFor`, in the required order. Both gates are required, all five match surfaces opt in, and raw remains permanently unavailable. No surface appends the choice locally.
- **Renderer-owned rules:** arm selection and session replacement are centralized in `attemptOfReapply`; the components only invoke the transition, fold the result, and render typed accessors. No second renderer-specific precedence rule was found.
- **Adoption spending and staleness:** reapply authorization remains keyed on the wire `ConflictResult` through `ConflictModel.source`. Manual-resolution refusals do not call adoption, adoption refusals do not newly spend a token, and the path contains no `await` between revalidation and the synchronous projection write.
- **Delete confirmation:** the deletion is not automatically reconfirmed. `runDelete` reads `identityInProjection(projections(), session.match)` at the click, and the mounted negative case would fail if that argument were replaced by `session.match`.
- **Interaction/model tests:** every changed component has mounted coverage for the offered or unavailable choice, and the five eligible handlers are observed changing model-visible state. The ordering, both gates, refusal-before-adoption, session-fold precedence, delete's live confirmation, and the mover's `alreadySatisfied` arm all have assertions that would flip under the corresponding one-line inversion. Apart from the prose defects above, no new test was found that could not fail for the production rule it claims to cover.
- **Decision record:** aside from repeating the affected outcome wording and incomplete sweep described above, the record matches the implemented choice authority, capabilities, component wiring, typed accessors, and stated test scope. It correctly makes no window-reading claim.
