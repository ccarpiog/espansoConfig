## Q1 — New match content

**RULING: Choose (a): `NewMatch { trigger: String, replace: String }`, with both fields mandatory.**

A trigger-only match should not be created: it is incomplete, and `save_match` cannot later insert the missing `replace` field. Other unsupported structures also cannot simply be “added afterwards” today. Accepting `MatchDraft` would advertise capabilities creation cannot provide. The author-chosen-key ban independently rules out raw `Vec<(String, String)>`; emitted keys must be fixed by the schema. If non-text bodies are later required, extend this to a closed body enum.

## Q2 — Created-match position

**RULING: Choose (iii) internally, exposed as (ii) on the wire.**

Use a command-level position such as `End`, `Front`, or `After { id: MatchId }`, and extend `InsertItem` with an explicit front position. The core planner must calculate the insertion span and trivia treatment. That does not violate D4: the command resolves identities, while the planner retains layout knowledge. Two transactions would create an avoidable intermediate state and revision churn.

## Q3 — Target sequence and missing `matches:`

**RULING: Target only the document’s top-level `matches` value; a missing `matches:` key is a named planning-time `CommandError`.**

Because creation has no existing `MatchId`, it also needs the application’s existing opaque document identifier—the exact type is not provided in the brief—not a wire `DocumentPath`. Existing primitives cannot defensibly create a missing `matches:` collection: an inserted field cannot synthesize it, and an `InsertItem` cannot address a node absent from the original syntax index. A bare implicit-null `matches:` remains supported. The missing-key refusal belongs in `Err`, not `SaveResult::Refused`.

## Q4 — Deletion result

**RULING: Use the proposed arguments and return `moved: None` after a successful deletion.**

`moved` denotes the new identity of the match acted upon; a deleted match has none. Returning a neighbour would overload that meaning with UI selection policy and could encourage positional identities. The caller should reload and choose its next selection from the new document state.

## Q5 — Primitive refusals

**RULING: Let all eight refusals emerge as typed `CommandError::SaveFailed(...)` errors from `save_document`; do not pre-plan them.**

D1 requires the `Err` channel rather than `SaveResult::Refused`; it does not require every refusal to be a top-level `CommandError` variant. Planning under the transaction’s lock and revision check is authoritative. Pre-planning would duplicate resolution and introduce disagreement races. This is correct only if the nested failure remains a discriminated object on the wire and every variant has the D5 serialization contract test.

## Q6 — Hole 5 presentation

**RULING: Preserve both blank lines and emit a `PresentationNote` only when deletion actually creates the doubled separation.**

The primitive must not choose which user-owned trivia to collapse. This should not be purely a UI concern because the syntax planner is the component that can reliably identify the condition. Have the core planning result carry the note through the successful transaction; do not re-inspect or reconstruct layout in the command wrapper.

## Q7 — Highest-risk mistake

**RULING: The greatest risk is deleting a different match after a stale `MatchId`’s old position has been repointed.**

Add a concrete test named `delete_match_never_deletes_the_item_at_a_stale_ids_old_path`: begin with matches A and B, retain B’s ID, commit creation of X at the front so B’s former path now addresses A, then call `delete_match` with B’s stale ID and revision. It must produce the established stale-ID/conflict outcome, perform no commit, and leave every byte of the post-create file unchanged.

## What I would build first

1. Extend the core insertion position with `Front`, including exact-byte planner tests.
2. Add the closed `NewMatch` and document/`matches` resolution.
3. Wire `create_match` exclusively through `save_document`.
4. Wire `delete_match`, including the Hole 5 presentation note.
5. Add wire-shape, acknowledgement, conflict, stale-identity, and byte-exact command tests.

Codex session ID: 019fc2c6-052d-7cb2-9956-c59ed1f0a595
Resume in Codex: codex resume 019fc2c6-052d-7cb2-9956-c59ed1f0a595
