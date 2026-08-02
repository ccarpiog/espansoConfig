# Phase 2b-2b-3 — design consult (Codex), before implementation

Three questions were put to Codex before `save_match` was written: how a `DraftError` should cross
the IPC boundary, what identity a successful scalar save should answer with, and whether the
plan-then-save sequence has an ordering hazard against a non-reentrant write lock. The brief was
self-contained — no web search, no repository access — and quoted only type shapes, never any
configuration content (CLAUDE.md §1).

The reply is reproduced verbatim below. The disposition table is in `PROGRESS.md`.

---

## Q1

**Recommendation: use `Err(CommandError::DraftRefused { error })`.**

A `DraftError` is a planning-time failure: no edit batch exists, no transaction ran, and acknowledgement can never change the outcome. That makes it directly analogous to `MoveNotWithinOneSequence`, not to `SaveResult::Refused`.

Keeping it outside `SaveResult` preserves a valuable boundary:

- `SaveResult::Refused`: the transaction evaluated a candidate and the semantic gate rejected it; findings may be acknowledged and retried.
- `CommandError::DraftRefused`: the requested operation cannot be represented safely; the user must change the draft or configuration structure.

Putting both under `SaveResult` would invite generic “refused save” UI to offer acknowledgement or retry behavior that can never succeed. The frontend should instead map the structured `DraftError` codes—including index operands—to localized corrective messages, without exposing private key strings.

**Strongest argument against this choice:** draft refusal is an expected domain outcome, not an infrastructure failure. Returning it through `Err` may cause generic command-error handling to present it as an exceptional failure or toast instead of inline form feedback. That is a real UI concern, but it should be solved by recognizing the stable `DraftRefused` code as an actionable validation category—not by weakening the transaction/planning distinction.

## Q2

**Recommendation: re-mint the identity using a general post-save locator based on the match’s full projected path; do not require a sequence-item address.**

The sequence-path-plus-index helper is specifically appropriate for moves because a move changes sequence position. A scalar save does not relocate the match container. Capture its full structural/projected path before saving, refresh the parse, resolve that same path, and mint a new `MatchId` carrying the returned revision.

Therefore:

- Do not refuse an otherwise valid edit merely because the match is not a sequence item.
- Do not routinely return `None` when the match has a stable non-sequence path.
- Keep `None` only as a defensive outcome if post-commit re-resolution genuinely fails. A successful disk write must not subsequently become `Err`, because the operation has already committed and reporting failure would encourage an unsafe retry.

If `None` is returned, the frontend must treat the successful save as authoritative, discard every stale identity and any identity-dependent editor state, then re-list the document before allowing another edit. It may show the saved state, but must not continue editing under the old `MatchId` or pretend it can reliably keep the same selection.

## Q3

**There is no lock-ordering or reentrancy hazard in that sequence.** Planning occurs without the write lock, and `save_document` alone acquires it and repeats the authoritative revision check. A concurrent modification between steps 2 and 5 is correctly converted into `RevisionMismatch`.

For step 4, **still call `save_document` with the empty batch and return its normal `SaveResult::Saved` with `committed: false`.** This preserves the under-lock revision check and the single authoritative save-result path. Short-circuiting from the cached view could report success even though the file changed after step 2.

Because the candidate is byte-identical, `committed: false` means:

- no write occurred;
- no new revision should be invented;
- no backup should be claimed;
- identities tied to that unchanged revision remain valid;
- the frontend should treat this as a successful no-op, not as a commit that invalidates identity.

Refresh should use or verify the revision returned by `save_document`; it should not assume a new revision merely because the result was `Saved`.
