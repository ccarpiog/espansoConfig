### Q1

Select the snippet occupying the deleted snippet’s former ordinal position, falling back to the new last snippet, and show a localized deletion notice.

This is not treating the deleted `MatchId` or `moved: null` as a position: after total invalidation and re-projection, the window performs ordinary selection repair against the new projection and adopts that snippet’s new identity. Preserving the stale identity would be incorrect, while clearing selection makes a successful list operation unnecessarily disorienting.

Strongest counter-argument: Selecting a neighbour may imply continuity with the deleted snippet even though no identity relationship exists.

### Q2

Implement deletion confirmation as a two-phase state transition in the tested editor value, with `requestDelete`, `cancelDelete`, and `confirmDelete`.

The protocol’s acknowledgement protects only finding-bearing candidates, so it cannot provide general destructive-action consent; a model-owned pending state makes confirmation mandatory, testable, localizable, and resistant to markup refactors. A component-only dialog recreates exactly the untested rule placement the project has rejected, while immediate deletion is disproportionate without in-app restore.

Strongest counter-argument: A native-looking component dialog is simpler and may provide better focus management and accessibility than a custom model-driven flow.

### Q3

Create a dedicated `matchCreation.ts` value module and keep its Svelte component as a rule-free walk over that value.

Creation has no projection, baseline, absent-key semantics, or reprojection debt, while both fields must be supplied before submission; forcing it into `matchEditor.ts` would manufacture meaningless baseline states and invite `Unchanged` logic into a command that only accepts complete values. The new value can still reuse the established draft-history and content-addressed acknowledgement spine.

Strongest counter-argument: A shared editor mode could reduce duplication in buffer, validation, history, and acknowledgement handling.

### Q4

Offer Front, After a named snippet, and End, defaulting to After only when the selected snippet belongs to the chosen document and current projection, and otherwise defaulting to End.

The After choice should store the selected snippet’s identity, never its ordinal position, and changing the destination file must clear or replace an incompatible anchor. Concurrent invalidation is safe because `baseRevision` makes the command conflict rather than reinterpret the anchor; defaulting unconditionally to After risks crossing documents, while always defaulting to End discards useful context.

Strongest counter-argument: Always defaulting to End is simpler and avoids presenting the most conflict-prone position as the normal path.

### Q5

Show every open file, but mark files without a projected match list as unavailable with a localized explanation.

Silently filtering a visible sidebar file makes the destination list appear incomplete, while submitting a command known to be structurally impossible turns an expected capability distinction into an avoidable error. The core remains authoritative—`documentHasNoMatchList` must still be handled—but the projection can honestly explain eligibility before submission.

Strongest counter-argument: Allowing every file to be submitted would avoid duplicating eligibility logic and ensure the engine alone defines what is writable.

### Q6

Disable deletion in the tested value when the current projection contains exactly one snippet, show the localized reason inline, and still handle the core’s refusal as authoritative.

The projected count provides immediate, honest feedback and avoids leading the user through confirmation for an operation already known to fail; the backend check remains necessary for concurrency and future rule changes. Treat the frontend condition as an affordance derived from current state, not as authorization, so drift can only produce a surfaced refusal rather than an invalid write.

Strongest counter-argument: Attempting every deletion would eliminate duplicated policy and always expose the engine’s exact current reason.

### Q7

Add a test that commits a deletion whose `moved` is `null`, changes every surviving `MatchId` in the returned projection, and asserts that no pre-commit identity remains anywhere in the view or selection.

The likeliest defect is interpreting `moved: null` as “leave the current selection alone,” then retaining the deleted or another pre-commit `MatchId` after replacing the projection. A deliberately identity-churning fixture catches that mechanism; fixtures whose surviving IDs happen to remain equal would let the stale-reference bug pass unnoticed.

Strongest counter-argument: The more probable integration failure may be skipping the re-read entirely on an apparently straightforward committed delete.

Codex session ID: 019fc74f-9d54-7de1-90a5-5a9c17788e88
Resume in Codex: codex resume 019fc74f-9d54-7de1-90a5-5a9c17788e88
