Unable to create `docs/reviews/phase-2c-5-4b-confirmation.md`: the workspace is mounted read-only. Full review follows.

# Phase 2c-5-4b confirmation review

## High

### 1. The frozen permit can bind one base revision while submitting another

**Confirmed defect:** [restore.ts](/Users/ccarpio/Developer/espansoConfig/src/lib/browser/restore.ts:1407), [restore.ts](/Users/ccarpio/Developer/espansoConfig/src/lib/browser/restore.ts:1834), [restore.ts](/Users/ccarpio/Developer/espansoConfig/src/lib/browser/restore.ts:1951)

The post-spend portion of the original High is repaired:

- `confirmRestore` builds `started` before the checked deletion.
- After successful `PENDING_AUTHORIZATIONS.delete(pending)`, it only files locals in `PERMITS` and returns `started`.
- The permit is sufficiently deeply frozen for its actual shape: its containers are fresh plain objects, entry identity is rebuilt from primitive strings, and the acknowledgement is cloned before recursive freezing.
- `permitHolds` compares the permit’s copied identity, base, hash, generation, and candidate bytes.
- `sendRestore` sends the permit’s submission.

However, `prepareRestore` obtains the two representations of the base revision from separate caller-controlled reads:

- `authorized.baseRevision` comes from `session.baseRevision`.
- `authorized.submission.baseRevision` comes from `submissionOf(preview.draft)`.

Nothing requires them to agree. `permitHolds` checks only the former, while `sendRestore` sends only the latter. The record expressly concedes that the snapshot may be internally inconsistent, but that concession is incompatible with the claimed exact binding.

Concrete failure scenario:

1. `session.baseRevision` reads A.
2. `preview.draft.baseRevision` reads B.
3. The pending question and all confirmation/send checks bind A.
4. Confirmation succeeds against a projection at A.
5. `sendRestore` calls the sender with B.
6. If the disk has moved to B while the window still projects A, the locked write can succeed using a base revision the confirmation did not bind.

Minimal fix: capture one base-revision local and use it for both `RestorePermit.baseRevision` and `RestorePermit.submission.baseRevision`, or reject registration when locally snapshotted values disagree. Add a regression where the two values disagree during `prepareRestore`, not merely after it.

### 2. Withdrawal remains re-entrantly spendable, and one withdrawing path was omitted

**Confirmed defect:** [restore.ts](/Users/ccarpio/Developer/espansoConfig/src/lib/browser/restore.ts:681), with openings at lines 1047, 1098, 1117, 1169, 1198, 1238, 1270, 1465, 2032, 2139, 2208, and 2321; overstated record at [2c-5-4b-notes.md](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-5-4b-notes.md:547)

`revokeConfirmation` cannot revoke before caller code: its first operation is `session.pending`. A getter there can call `confirmRestore` on the retained asked session, moving the authorization from `PENDING_AUTHORIZATIONS` to `PERMITS`. The outer deletion then finds nothing and cannot revoke the already-minted permit.

`cancelRestore` has the same opening directly. Most callers of `withdrawn` additionally read `phase`, entry, target, batch, base revision, or other caller properties before invoking it. `acknowledgeRestoreFindings` performs its state and consent calculations before revocation.

Concrete failure scenario:

1. Prepare a pending question.
2. Install a getter on the first session property read by a withdrawing transition—or on `pending` itself.
3. Have that getter call `confirmRestore` once and retain its `StartedRestore`.
4. Invoke cancellation, catalogue refresh, selection change, candidate arrival/refusal, target-revision observation, answer application, confirmation withdrawal, or acknowledgement.
5. The transition returns a state with no pending question, but the captured `StartedRestore` owns a live permit and can send the withdrawn candidate.

There is also an omitted withdrawing transition: [reloadTheDiskVersion](/Users/ccarpio/Developer/espansoConfig/src/lib/browser/restore.ts:2321). Its successful path calls `measuredAgainst`, which clears `pending`, but only after:

- `conflictOf(session)`;
- `session.reload`;
- the arbitrary `adopt` callback;
- a spread of `session`;
- `conflict.diskRevision`.

Thus the record’s statement that every existing withdrawal revokes first is false even apart from the helper’s own getter opening.

Minimal fix: key pending authorization by an identity that can be deleted without reading a caller property—most simply the exact asked `RestoreSession` returned by `prepareRestore`. Make confirmation and every withdrawal delete that identity before any session/context read or callback. Route `reloadTheDiskVersion` through the same revocation. Add re-entrant getter and callback tests; the new table tests only eventual deletion with plain objects.

### 3. `adoptDiskVersion` can install two documents from one confirmation

**Confirmed defect:** [workspace.svelte.ts](/Users/ccarpio/Developer/espansoConfig/src/lib/browser/workspace.svelte.ts:2042); unsound adjudication at [2c-5-4b-notes.md](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-5-4b-notes.md:591)

The later revision/generation checks neutralize a same-document re-entrant installation. They do not neutralize a conflict whose getters alternate between two remembered documents, because projection generations are per document.

Concrete failure scenario:

1. Bind one `ReloadConfirmation` to a conflict model with getters.
2. During the outer call, let `authorizeDiskAdoption` snapshot disk A.
3. At the later `conflict.source` read, re-enter with the same model and confirmation, but expose remembered source/disk B.
4. The inner call sees the confirmation unspent, adds it, and installs B, bumping only B’s generation.
5. The outer call has already passed `spentConfirmations.has`.
6. It resumes with remembered source A. A’s generation is unchanged, so it adds the same confirmation again and installs A.

One answer therefore causes two projection installations and two selection repairs.

Minimal fix: reserve the confirmation immediately after `has`, with no caller-controlled operation between `has` and `add`, and roll back that reservation on refusal if refusals must remain retryable. Alternatively, construct a complete installation plan first and authorize it with a checked deletion from a private pending map immediately before installing from that plan. Add a cross-document alternating-getter regression.

## Medium

No confirmed Medium defects.

Finding 3 is closed. `panels()` supplies 16 UI states and crosses them with both locales. It covers:

- the question;
- committed success;
- committed success plus invalidation failure;
- no-write success;
- refusal;
- both send-failure arms;
- three conflict/reload states;
- all six exhaustively enumerated competing-surface refusals.

Each walk asserts evidence before scanning. The base conflict proof, `nothingWasWritten`, is shared with refusals, but the warning and refused-reload rows independently require conflict-only controls, so the conflict family is still genuinely reached and scanned.

## Low

No confirmed Low defects.

Finding 4 is closed. [RestorePane.test.ts](/Users/ccarpio/Developer/espansoConfig/src/lib/components/RestorePane.test.ts:747) asserts:

- both named invisible segments;
- three `<br>` elements;
- all three untrimmed text runs.

The lone carriage return makes the otherwise indistinguishable rendering property testable, while the save-boundary test retains the exact CRLF evidence.

Finding 5 is closed. [2c-5-4b-notes.md](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-5-4b-notes.md:170) now accurately limits executable evidence to current key mappings and current dictionary values, while attributing historical byte identity to the diff. The code agrees: existing `confirmReload` mappings and English/Spanish values are unchanged; only the new retargeting key and value were added.

## Other requested adjudications

- `openWholeDocumentSave`: the safety claim is sound. Between `SEALS.get(sealed)` and `SEALS.delete(sealed)` there is only a local strict comparison and return branch. WeakMap identity operations and that comparison invoke no caller code, so the discarded deletion cannot lose a re-entrant race.

- The rewritten restore tests still prove real properties. The four zero-count draft getters prove that `confirmRestore` no longer derives a submission. The drifting-base and drifting-candidate cases prove that the permit is retained and used after the question.

- Moving the pre-spend hook to `session.previewGeneration` is correct because pending fields are no longer consulted. WeakMap key identity and the cloned-question case cover the removed pending-field comparison. The missing test is disagreement during permit construction, identified in High 1.

- Replacing the WeakSet with a WeakMap preserves exact identity and one-shot behavior. Checked deletion still prevents one question from minting two permits. The defect is snapshot consistency, not WeakMap identity.

- Every current `withdrawn` call passes the correct arm: catalogue and revision changes retain the candidate; batch, entry, and candidate changes drop it. The signature change introduced no wrong-arm regression.

- No Svelte 5 reactivity regression or dead production code was confirmed in the changed files.

## Original finding status

1. **Partially closed.** No caller-controlled read remains after the checked confirmation spend, and the permit is sufficiently deep-frozen. However, the independently read permit base and submission base can disagree, and only one is rechecked.

2. **Still open.** Sequential withdrawal now deletes the authorization, but getter/callback re-entrancy can mint the permit before deletion. `reloadTheDiskVersion` was also omitted.

3. **Closed.** The parameterized bilingual scan reaches the relevant outcome and refusal families with asserted evidence.

4. **Closed.** The exact-candidate representation is pinned at the level the DOM can distinguish.

5. **Closed.** The record now states accurately what tests and the historical diff each establish.

All three High findings above have concrete synchronous getter or callback executions; none is merely a suspicion.

Codex session ID: 01a00222-d02d-7b32-a270-b48e5da17faa
Resume in Codex: codex resume 01a00222-d02d-7b32-a270-b48e5da17faa
