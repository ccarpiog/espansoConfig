`VERDICT` — This is the right shipping slice only if “move on a screen” includes repairing the wrapper, introducing a rule-owning move model, drawing the pane, and completing all three evidence kinds. Implement it in two reviewable commits, but do not treat the model-only commit as a completed phase. The largest risk is conflating three different facts—command answered, bytes committed, and the window successfully adopted the new projection—which can leave the UI lying about either the disk or the selected identity.

`Q1` — Use a destination panel in the detail pane as the canonical affordance: **Top**, **After…**, and **End**, followed by one explicit Move action. “End” is a valid UI operation even without a wire-level `End`; lower it to the last other snippet’s identity, or `null` when appropriate. Exclude the moving snippet from anchors. Defer row controls and drag-and-drop. Future nudge buttons would be a second affordance but must feed the same placement and submission path.

`Q2` — Split the work into two commits/checkpoints, not two independently shippable phases. First land the wrapper repair, pure move model, and model tests; then add the component, mounted test, and manual reading. This preserves review leverage without pretending the first commit satisfies the phase’s evidence requirements.

`Q3` — Return exactly `MatchSaveAnswer`. A move has no additional durable result beyond `SaveResult.moved`; a “landed position” would duplicate the adopted projection and could become stale. Mirror `saveMatch` completely: retain committed outcomes when adoption fails, forget the replaced projection, use `forgetTextOf(document)`, and preserve `committed:false` as success. Reuse the shared outcome presenter, while allowing the move view to omit an always-empty notes section.

`Q4` — Offer only anchors from the target’s actual snippet list, with an explicit boundary message such as “Moves stay within ‹file›; snippets in other files are not destinations.” In “All,” retain that explanation beside the destination list. Do not inflate the pane with every out-of-domain snippet rendered disabled; the creation rule about showing ineligible files is not universally applicable.

`Q5` — Follow the moved snippet only if it remains the current selection when the answer arrives. If the person selected something else, never reclaim selection for the moved item; attempt the existing safe repair and clear the selection if it cannot be proven. Add a generic notice such as `invalidatedByCommit` rather than a move-specific `moved` notice or the misleading `differentMatch`.

`Q6` — Search results must not define document order. The destination panel should use the complete, unfiltered snippet list and name the chosen anchor explicitly: “Move in this file, directly after X.” If nudges are later added, they should mean previous/next item in the file, not previous/next search result.

`Q7` — Do not add a separate confirmation dialog. Choosing a destination and pressing Move is already a deliberate two-step interaction. Only a validation refusal should introduce the conditional acknowledge-and-retry step; copying deletion’s destructive confirmation would add ceremony without resolving additional risk.

`Q8` — Present `moveNotWithinOneSequence` as a typed command failure using the existing translation, with a **Reload file** recovery action. Treat it internally as an invariant breach worth diagnostics, but do not expose that jargon or misclassify it as an acknowledgeable save refusal.

`Q9` — R25 needs no direct UI message because this UI cannot request a combined batch. A dirty field draft is still not a combined edit. For usability, require the target snippet’s dirty draft to be saved or discarded before beginning a move, owned by a testable coordinator/model, with truthful copy about preserving edits—not a false claim that the core forbids two sequential transactions.

`WHAT THE BRIEF GETS WRONG`

1. R25 cannot be “surfaced” by the proposed UI: no available action expresses the prohibited batch. Inventing a warning would describe a request the person never made.

2. A dirty draft plus a move is not R25. Blocking it may be good workflow protection, but it is a stricter frontend policy intended to avoid identity invalidation or a predictable later conflict.

3. D2r/R25 are not the same kind of refusal as `SaveResult.refused`. The latter carries acknowledgeable findings; identity and sequence failures are command failures and require different presentation.

4. “Same file” is not the contractual invariant; “same sequence” is. The current projection happens to expose one particular sequence per file, but the model should preserve that provenance rather than encode a general file-equals-sequence assumption.

5. A stale projection does not normally produce `moveNotWithinOneSequence`: `view_at` checks the base revision first, so it should produce `identityStaleRevision`. The sequence error indicates an unsupported identity/path or frontend/backend invariant breach.

6. No wire-level `End` does not mean the UI cannot offer **End**. It can be compiled to an identity anchor without weakening the contract.

7. A `saved` answer does not imply that bytes were written or that identities necessarily changed: `committed:false` is a successful no-op and must not be described as a disk change.

8. The creation screen’s “show every ineligible destination” decision is not a universal rule. Other-file snippets are outside a move’s destination domain, not failed candidates that each need a row.

9. Calling this merely the same “identity mistake” as new/delete understates the work. Move adds order semantics, filtered and multi-file presentation, self-anchor exclusion, and selection changes occurring during an in-flight reorder.

`WHAT THE PHASE MUST NOT SHIP WITHOUT`

- `MatchSaveAnswer` parity, including adoption failure, `mayHaveWritten`, `committed:false`, and `forgetTextOf`.
- A pure move model with live-click identity validation, plain identities, frozen submission revision, self-anchor exclusion, and acknowledgement retry.
- Explicit same-list scope, filtered-list semantics, dirty-draft coordination, and typed presentation for every reachable command error.
- Model tests plus a mounted keyboard/focus test covering saved, refused, conflict, and failed adoption paths.
- A bounded destination pane measured in Spanish at the target window size.
- A re-taken manual window reading and a correctly derived production module-count baseline.

Codex session ID: 019fc896-718e-77f3-a8a2-002acffb111b
Resume in Codex: codex resume 019fc896-718e-77f3-a8a2-002acffb111b
