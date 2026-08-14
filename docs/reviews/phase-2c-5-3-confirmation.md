# Phase 2c-5-3 fix-round confirmation review

## Verdict

Changes requested. H1 still stands in a narrower form: the returned `StartedRestore` is one-shot, but the authorization that produces it is not. Replaying the same pending session through `confirmRestore` mints two independent permits, and both pass the live recheck and send. M1, M2, M3, L1 and L2 are closed. No separate new finding was found.

The requested gates were not rerun. `docs/decisions/2a-3b-notes.md` was ignored. No web search or URL fetch was used.

## Original findings

### H1 — still standing (narrower): one authorization can mint more than one spendable permit

- **Classification:** High, behavioural.
- **Files and lines:** `src/lib/browser/restore.ts:1338-1383`, especially `PERMITS.set(started, ...)` at line 1375; the executable counterexample is `src/lib/browser/restore.test.ts:1006-1019`; the residue is recorded at `docs/decisions/2c-5-3-notes.md:138-140` and `docs/decisions/2c-5-3-notes.md:513-514`. The overbroad one-shot claim remains at `src/lib/browser/restore.ts:35-38` and in the test name at `src/lib/browser/restore.test.ts:964`.
- **Exact defective expression:** `PERMITS.set(started, { ... })` is unconditional after validating `session.pending`; no module-private runtime state records that this particular `PendingRestore` has already been confirmed.
- **Exact contradicted sentence:** “One confirmation therefore authorizes at most one send.”
- **Why it is wrong:** the `WeakMap` closes reuse, cloning and re-entrant spending of one returned `StartedRestore`. `sendRestore` also deletes its permit synchronously before the only call to `send`, has no `await` between recheck and spend, and rechecks the document, base revision, opaque entry identity, candidate revision, candidate bytes, preview generation, observed revision, read-only/restored/conflict/phase state, and competing-surface predicate. A `StartedRestore` literal or clone cannot reach a permit. Those parts of the fix are sound.

  The authorization before that object is minted remains replayable, however. Calling `confirmRestore(session, context)` twice with the same session containing the same `PendingRestore` creates two distinct `StartedRestore` keys and two permits. Each returned session is independently in `saving`, each matches all permit fields, and both calls to `sendRestore` reach `send`. The suite deliberately proves two sends at lines 1006-1019. Consuming `pending` only in the returned session is not a runtime spend of the pending authorization; a caller can discard that returned state, and `structuredClone` or another retained copy makes the same limitation broader than a single object reference. This violates Q8's requirement that the five values be bound into one **unspent confirmation**. It is not equivalent to bypassing the model and calling the public raw-save primitive: it occurs entirely through the intended exported confirmation-and-send path with live, agreeing session/context values.
- **Concrete fix:** keep module-private runtime membership for pending confirmations. For example, put every `PendingRestore` minted by `prepareRestore` in a private `WeakSet`, require membership in `confirmRestore`, and delete it synchronously after all confirmation checks but before minting the permit. This both spends the original pending object and rejects structurally cloned pending values that were never registered. Add cases confirming the same session twice before either send and confirming a structured clone; only the first call may return a `StartedRestore`, and the sender must run once. Then narrow or correct the header, test name and decision record so “one confirmation” means the actually spent authorization rather than merely one returned permit key.

### M1 — closed

The nine exported catalogue/selection/candidate/base mutators are all frozen by `phase === 'saving' || restored`: `loadingBatches`, `batchesLoaded`, `chooseBatch`, `loadingEntries`, `entriesLoaded`, `chooseEntry`, `candidateRead`, `candidateRefused`, and `targetRevisionObserved` (`src/lib/browser/restore.ts:865-1090`). This is the right predicate for those nine: neither an in-flight answer nor a committed session may move the candidate or what it is measured against.

Every other exported transition was also enumerated. `prepareRestore` is frozen indirectly by `restoreRefusal`; `confirmRestore` is likewise refused; `cancelRestore`, `askToReloadDiskVersion`, `confirmDiskReload`, and `reloadTheDiskVersion` return their argument on reachable in-flight state; `acknowledgeRestoreFindings` and `dismissRestoreOutcome` explicitly freeze only during the flight, correctly remaining callable/no-op-by-predicate or dismissible after commit; `applyRestore` and `restoreCouldNotBeSent` are answer transitions and must end the flight. `startRestore` creates rather than mutates a session. The remaining exports (`competingSurfaceFor`, key functions, `candidateText`, `revisionInProjection`, `conflictOf`, `restoreRefusal`, `canPrepareRestore`, `restoreView`, and `baseRevisionOf`) are reads/derivations. No missed mutating transition survives M1.

`RestoreSession.inFlight` freezes both the exact submission and its preview, and `applyRestore` describes the answer from that record. The in-flight sentence is therefore true of all reachable public transitions. Dropping a catalogue/candidate answer during a send is a deliberate consequence, not M1 surviving.

### M2 — closed

`applyRestore` requires `InvalidateEverySurface` and passes it inside `openWholeDocumentSave`'s callback at `src/lib/browser/restore.ts:1632-1646`. It records `invalidation.revision` before invoking the coordinator. `openWholeDocumentSave` invokes that callback only for a committed save, catches a throw and returns its classified invalidation failure beside the already-opened outcome. `applyRestore` then preserves the saved arm, uses the committed revision and appends `windowOutOfStep` (`src/lib/browser/restore.ts:1650-1697`). A conflict, refusal, and `committed: false` success do not invalidate surfaces. The required callback cannot prove that its body is complete, but that is accurately stated as the same signature limit as the established invalidation protocol, not the original missing-coordinator path.

### M3 — closed

Both `targetMoved` sentences now state only that the window no longer holds the reading against which the candidate was set up and that the replacement must be prepared again (`src/lib/i18n/en.json:481`, `src/lib/i18n/es.json:481`). Neither language claims whether a command was sent or whether the file was written. The predicate at `src/lib/browser/restore.ts:1146-1147` supports the revised text.

### L1 — closed

The touched restore and shared-outcome prose consistently says that the candidate is the exact text **read from** a backup entry. It does not claim that the entry still exists, still holds those bytes, is authentic, is older/newer, was preserved by the application, or is recoverable. The decision record explicitly states the current-state limit at `docs/decisions/2c-5-3-notes.md:272-278`. The operation strings’ “text of the backup entry selected here” describe the requested operation and selected source; they make no current catalogue or recoverability claim.

### L2 — closed

The already-opened branch opens the seal first, receives `alreadyOpened`, and returns the existing outcome by identity while setting `phase: 'editing'` and `inFlight: null` (`src/lib/browser/restore.ts:1641-1649`). The JSDoc, test name and decision record now name exactly those effects and the test asserts them plus one invalidation discharge (`src/lib/browser/restore.test.ts:1380-1396`; `docs/decisions/2c-5-3-notes.md:343-348`). None says that the whole session is unchanged.

## `applyRestore` seal-order audit

The seal is opened at `src/lib/browser/restore.ts:1641` before the first return at line 1647. There is no earlier return based on `preview`, `submitted`, `inFlight`, phase or outcome. A missing frozen presentation record results in no invented outcome but still records a committed revision, sets `restored`, and runs invalidation. A throwing invalidator is caught by the opener; it cannot propagate as a save failure or replace the committed arm. The original stranded-commit defect is closed.

## Fix-round claim audit

Apart from H1's overbroad one-confirmation/one-shot characterization, the changed JSDoc, comments, English and Spanish strings, test names, and decision record match their predicates. In particular, `conflictShowing` is licensed by a conflict result (which establishes that attempt wrote nothing), while `targetMoved` no longer borrows that claim; `reloadRetargetsCandidate` says the reload/adoption writes nothing and retains the already-read candidate, which its transition establishes; and the L1/L2 corrections do not leave a narrower current-provenance or unchanged-session claim.

## Recorded residues

- **Live session/context not forced:** correct to leave for the component boundary, and accurately stated in `docs/decisions/2c-5-3-notes.md:510-512`. TypeScript cannot prove the provenance or freshness of ordinary arguments. This does not excuse H1: the duplicate-permit counterexample uses live, matching values.
- **Catalogue/candidate answer dropped during a send:** correct under the chosen truthful freeze and accurately stated at `docs/decisions/2c-5-3-notes.md:515-517`. The note correctly records that even `loading` can remain and that step 2c-5-4 owes a way to ask again.
- **`rawEditor.test.ts:487` carries L2's old claim:** correct to leave outside this fix round's specified changed files and accurately stated at `docs/decisions/2c-5-3-notes.md:520-526`. It is identical wording over an identical branch shape, but belongs to shipped, separately reviewed work; the record neither claims it was fixed nor hides it.

The additional recorded residue at notes lines 513-514 — two permits from one pending session — is stated factually, but its adjudication is wrong: it is H1 surviving, not an acceptable type-system limit.

## New findings

### High

No separate new High finding. H1 is the original High finding still standing in the narrower form above.

### Medium

No new Medium finding.

### Low

No separate new Low finding. The false one-confirmation/one-shot wording is part of the still-standing H1 behavioural guarantee and should be corrected with that fix.

## Third pass — the H1 spend

### Verdict

Changes requested. **H1 is still standing.** Round 2 added the right runtime identity, but `confirmRestore` tests that identity and spends it in two separate operations with caller-controlled property reads between them. One registered question can therefore still mint two spendable permits and reach `send` twice.

The requested gates were not rerun. No web search or URL fetch was used.

### H1 — still standing: the membership check and spend are not atomic

- **Classification:** High, behavioural.
- **File and lines:** `src/lib/browser/restore.ts:1424-1446`, especially `if (!PENDING_CONFIRMATIONS.has(pending))` at line 1424, the property reads at lines 1427-1439, and the unchecked `PENDING_CONFIRMATIONS.delete(pending)` at line 1446.
- **Exact defective expressions:** `if (!PENDING_CONFIRMATIONS.has(pending)) { return null; }` and, after the field checks, `PENDING_CONFIRMATIONS.delete(pending);`.
- **Why it is wrong:** synchronous JavaScript can re-enter through a getter or proxy trap. The exact object registered by `prepareRestore` is returned to the caller as `session.pending` (`src/lib/browser/restore.ts:1248-1258), and `readonly` in `PendingRestore` (`src/lib/browser/restore.ts:532-544`) does not freeze that object at runtime. A caller can install a guarded getter on that registered object's `document` property. The outer call passes `has(pending)` at line 1424 and invokes the getter at line 1427. The getter re-enters `confirmRestore` with the same session; the inner call passes membership, completes the checks, deletes the membership, and reaches `PERMITS.set` at lines 1460-1467. The outer getter then returns the matching document, the outer call completes its remaining checks, line 1446 returns `false` but that result is ignored, and the outer call reaches a second `PERMITS.set`. The same opening exists through traps/getters reached from `pending.entry`, `preview.entry`, and the other values read at lines 1427-1439. The two distinct returned `StartedRestore` objects are distinct live keys in `PERMITS`; each can pass `sendRestore`'s recheck and deletion at lines 1629-1640, so the sender can run twice for one answered question. The new test at `src/lib/browser/restore.test.ts:1057-1085` exercises re-entry only from `submissionOf(preview.draft)` at line 1447, which is already after the deletion, and therefore does not cover this earlier opening.
- **Fix:** perform all refusal and field checks first, then make the spend itself the membership test immediately before deriving the submission: `if (!PENDING_CONFIRMATIONS.delete(pending)) { return null; }`. `WeakSet.delete` does not invoke user code. This preserves the required refusal behavior because no deletion is attempted until all checks pass, rejects an unregistered clone because `delete` returns `false`, and permits only the first of two ordinary or re-entrant callers to proceed to `PERMITS.set`. Add a regression case that installs a guarded getter on the registered `PendingRestore` (or a proxy below one of its fields), re-enters during lines 1427-1439, and proves that only one call returns a `StartedRestore` and only one send occurs.

### M4 — round 2 claims a re-entrancy guarantee its test does not establish

- **Classification:** Medium, claim.
- **Files and lines:** `src/lib/browser/restore.ts:1-4, 39-44, 56-66, 548-565, 638-647, 1387-1406, 1442-1445`; `src/lib/browser/restore.test.ts:12-19, 1008-1026, 1057-1085`; `docs/decisions/2c-5-3-notes.md:23-25, 127-134, 168-183, 481-482, 501-509, 540-546, 584-589`.
- **Exact false sentences:** “no path reaches `PERMITS` twice for one question” (`restore.ts:563-564`); “a caller who cannot confirm twice” (`restore.ts:1389-1390`); “One question therefore mints at most one permit, whatever the caller does” (`restore.ts:1404-1405`); the comment that no “second call, or a getter that re-enters” reaches `PERMITS.set` twice (`restore.ts:1442-1445`); the test name “is one per question, so confirming the same session again is refused” (`restore.test.ts:1008`); the test comment “a getter reached there is the one place a caller can re-enter” (`restore.test.ts:1059-1062`); and the decision-record conclusions “one question yields at most one permit” (`2c-5-3-notes.md:168-171`) and “What is *closed* is that one question mints at most one permit” (`2c-5-3-notes.md:584-586`). The corresponding test-evidence claims at `2c-5-3-notes.md:481-482, 501-509, 540-546` are also overbroad: the named re-entrancy test covers only the post-delete draft getter, not property access between `has` and `delete`.
- **Why it is wrong:** the H1 counterexample above directly contradicts every one-shot, single-answer, and exhaustive re-entrancy sentence listed here. The sentences mistake “delete before `PERMITS.set`” for an atomic spend, while the actual authorization decision begins at `has` and remains live across property access capable of executing arbitrary JavaScript.
- **Fix:** make successful `delete` the single membership decision after validation, add the pre-delete re-entrancy regression, and then retain these claims with wording tied to that checked deletion. Until then, narrow the test and mutation-accounting prose to the post-delete getter case and do not record H1 or hole 8 as closed.

### Narrow claims and residues

No further finding was found. `prepareRestore` is the only registrar: the sole `PENDING_CONFIRMATIONS.add(pending)` is at `src/lib/browser/restore.ts:1257`, and `confirmRestore` correctly refuses a `structuredClone` at lines 1424-1425 because the clone is not the registered key. The refusal ordering is otherwise correct: all substantive checks precede line 1446, so an ordinary refusal does not spend membership; the defect is that a successful deletion is not required before minting.

The two stated residues are correctly identified, independently of the re-entrancy defect. `cancelRestore` clears only the field at `src/lib/browser/restore.ts:1276-1277`, and `withdrawn()` clears the field without deleting membership at lines 869-874; reinserting or retaining the still-unanswered object is a caller re-asking, not a second successful answer. `withdrawn()` also increments `previewGeneration` at line 872, so placing the old question into the returned withdrawn session fails the generation check at lines 1437-1439. Separately, `prepareRestore` rejects only an already-present pending value at line 1242 and registers a fresh object at lines 1248-1257 whenever an eligible session has none, so `docs/decisions/2c-5-3-notes.md:185-193` and hole 8 at lines 584-589 correctly say that a session may be asked more than once and that each newly prepared question is a distinct authorization. Those residues do not authorize two answers to one question once the spend is made atomic.

### Exhaustive touched-sentence addendum

M4 also covers these exact round-2 sentences, which state the same false guarantee: “the two private memberships that make one answered question authorize at most one write” (`src/lib/browser/restore.ts:2-4`); “one question yields at most one permit” and “one answered question authorizes at most one write” (`src/lib/browser/restore.ts:39-44`); “the permit came from a question that had not been answered before” (`src/lib/browser/restore.ts:56-58`); “that is `PENDING_CONFIRMATIONS`” in the sentence claiming what makes a confirmation one-shot (`src/lib/browser/restore.ts:638-639`); “the one-shot spend at both memberships” and “a valid unspent confirmation” (`src/lib/browser/restore.test.ts:16-19`); “the two private runtime memberships that make one answered question authorize at most one write” (`docs/decisions/2c-5-3-notes.md:23-25`); and the **Forced** claim that a write's permit was “minted from a question that had not been answered before” (`docs/decisions/2c-5-3-notes.md:127-134`). They are wrong for the same reason as H1: after the inner re-entrant call deletes the membership and mints a permit, the outer call ignores its failed deletion and mints another. The fix is the same checked atomic spend at line 1446; no separate behavioural finding is needed.

The narrower round-2 corrections are sound. “one permit writes at most once” (`src/lib/browser/restore.test.ts:965`) is exactly enforced by `PERMITS.delete(started)` before `send` (`src/lib/browser/restore.ts:1629-1640`). The `previewGeneration` sentence expressly disclaims one-shot enforcement (`src/lib/browser/restore.ts:633-639`), and the `PERMITS` documentation limits its claim to the permit and places the question spend one step earlier (`src/lib/browser/restore.ts:1343-1351`). Neither introduces another false claim beyond M4's incorrect assertion that the earlier spend is already effective.

## Fourth pass — the atomic spend

### Verdict

**H1 is closed. M4 is closed.** The checked `PENDING_CONFIRMATIONS.delete(pending)` at `src/lib/browser/restore.ts:1465` is now the sole membership decision in `confirmRestore`, and success of that one operation is required before the function can reach `PERMITS.set` at line 1481. No path can mint two permits for one registered question. Two narrower claim findings remain; neither is a behavioural reopening of H1.

The requested gates were not rerun. No web search or URL fetch was used.

### Atomic-spend and ordering audit

All refusal and field checks are before the checked deletion at lines 1435-1453. A refusal taken by one of those checks does not delete the membership. Once those checks have passed, `WeakSet.delete` both decides membership and removes it without invoking a getter or proxy trap. If a read before the deletion re-enters, the inner and outer calls may both reach the deletion, but only one can receive `true`; only that call continues to `PERMITS.set`. If the inner call refuses before deletion, it spends nothing and the outer call may proceed. Thus the registered question cannot mint two permits through `session.pending`, `session.preview`, `canPrepareRestore`, any pending/session/preview field read, or a nested proxy trap.

The deletion also precedes `submissionOf(preview.draft)` at line 1468, construction and spreading of the returned session at lines 1471-1479, all permit-field reads at lines 1482-1487, and `PERMITS.set` itself. Re-entry from any getter or proxy trap reached after the deletion therefore performs the checks but fails its own deletion and cannot mint another permit. The successful call spends the question before minting; an ordinary pre-spend refusal leaves the membership intact. The four recorded mutations at `docs/decisions/2c-5-3-notes.md:542-557` match the predicates of the four cases at `src/lib/browser/restore.test.ts:1009-1130`: the new pre-spend getter case uniquely distinguishes round 2's split `has`/unchecked-`delete` shape, while the other three cases separately require membership, preserve membership on a pre-spend refusal, and require spending before permit derivation/minting.

The prior M4 one-shot claims are consequently licensed now: `prepareRestore` is the sole registrar (`restore.ts:1267`), `confirmRestore` has one checked deletion and one `PERMITS.set`, and `sendRestore` deletes the resulting permit before calling the sender (`restore.ts:1650-1662`). The previously unchanged claims at `restore.ts:2-4`, `restore.ts:1422-1424`, the `PERMITS` documentation at `restore.ts:1352-1364`, `restore.test.ts:966`, `restore.test.ts:1009`, and `2c-5-3-notes.md:23-25` are true on that code. The remaining unchanged `RestoreSession.pending` documentation is not; it is L3 below.

Section 2.2a's account of why round 2 missed H1 at `2c-5-3-notes.md:191-198` is accurate: absence of `await` excludes suspension, not synchronous re-entry, and the round-2 test entered only through `submissionOf` after the unchecked deletion. The section nevertheless adds a separate false equivalence claim at lines 200-207, recorded as M5 below.

### New findings

#### M5 — removal of the early membership check is observably different

- **Classification:** Medium, claim.
- **File and lines:** `docs/decisions/2c-5-3-notes.md:200-207`.
- **Exact false sentences:** “`confirmRestore` answers a bare `null` carrying no reason, so *which* check refuses is unobservable and no refusal behaviour changed.” The preceding “Every case it refused is still refused” is also overbroad as a statement of behaviour rather than only of the eventual result for inert values.
- **Why it is wrong:** the removed `has` used to reject an unregistered or already-spent `pending` before the field reads now at `restore.ts:1440-1452`. Those reads are explicitly treated elsewhere in this fix as capable of invoking arbitrary getters or proxy traps. An already-spent registered object, or an unregistered object whose fields otherwise match, can now run those traps before `delete` returns `false`; a throwing getter can make `confirmRestore` throw instead of returning `null`, and a getter can cause other observable effects or re-enter another confirmation. The membership outcome is unchanged for inert values, and this does not defeat the atomic spend, but the refusal behaviour is not unobservable or unchanged.
- **Fix:** narrow the paragraph to the actual equivalence: for ordinary inert values, every value formerly rejected by `has` still ultimately returns `null`; removing it intentionally allows pre-deletion field access before an unregistered or already-spent question is rejected. Do not claim general behavioural equivalence.

#### L3 — `RestoreSession.pending` does not mean the question is still unanswered

- **Classification:** Low, claim.
- **File and line:** `src/lib/browser/restore.ts:653`.
- **Exact false sentence:** “The question that has been asked and not answered, or `null`.”
- **Why it is wrong:** `confirmRestore` spends the private membership and returns a new session with `pending: null`, but it does not and cannot mutate the caller's retained input session. After a successful confirmation, that retained session still has the same non-null `pending` object even though its membership is gone and the question has been answered. The documentation immediately below correctly says that setting the field to `null` is presentation rather than the spend, so the opening sentence contradicts the arrangement it documents.
- **Fix:** describe the field as presentation, for example: “The question this session presents as pending, or `null`; only membership in `PENDING_CONFIRMATIONS` says whether it remains unanswered.”

No new behavioural finding was found. H1 does not stand in a narrower form: M5 concerns observability before a failed spend, and L3 concerns the meaning of a retained value; neither supplies a second successful deletion or a second permit for one question.

No further finding was found in the third-round confirmation-spend change or its touched sentences.
