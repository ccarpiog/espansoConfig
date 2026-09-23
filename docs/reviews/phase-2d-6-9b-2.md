Reviewer: autoclaude adversarial reviewer

# Phase 2d-6-9b-2: adversarial review

Scope: the uncommitted tree against `76c4dbb`, leaving out the four instrument paths. I read the diff for the eight renderers, `SnapshotAcknowledgement.svelte`, `DetailPane.svelte`, `reconciliationStatus.ts`, `observationDelivery.ts`, the session comment edits, i18n, and the `MatchEditor.test.ts` suite.

## BLOCKERS

None found.

## SHOULD-FIX

1. `src/lib/browser/matchEditor.ts:3249-3250`. The sentence contradicts itself: "Codes, rendered through `tExternalConflictNotice`, never sentences; Since Phase 2d-6-9b-2 no renderer draws them as sentences". Nothing calls `tExternalConflictNotice` any more (no `.svelte` match). The first clause is stale, and "Since" is capitalised in the middle of the sentence. This is a small §5 defect: a comment that describes a rendering path that no longer exists.

## Risks probed

- **Risk 1 (origin).** Every renderer computes `external` from `view.conflict`. Every session's conflict is `session.externalConflict ?? conflictArm(...)` (`matchEditor.ts:1248`, `matchMove.ts:1097`, `rawEditor.ts:680`, `restore.ts:2282`). The `acknowledge…Snapshot` transitions pass `session.externalConflict.source` (`matchEditor.ts:2379`, `recovery.ts:2827`). So `shown`, `refusalFor` and the minted source are all the same object. The port's `refusalFor` answers `superseded` whenever the standing origin is some other object (`reconciliationStatus.ts`, `surfaceAcknowledgementPortOf`). I found no path that acknowledges an origin other than the one drawn.
- **Risk 2 (exits).** For `projectionReplaced` and `superseded`, the only exit named is "a further change … observed and shown here". A later write from this window ends the window's hold but not the session's withheld reload, and the state then becomes `holdMoved`. That is consistent with the `acknowledgeSnapshot` doc at `matchEditor.ts:2358-2362`. Both sentences say "until", and "On this panel" covers closing the panel as an exit. I did not check whether a new delivery always re-registers an origin at the current projection generation.
- **Risk 3 (nothing shown).** `headerFilesOf` covers every registered surface's document target, and `recovery` is a surface kind (`restore.ts:446`). When the window's hold is gone but the session still withholds (`holdMoved`), the pane block drops its sentence. The panel still draws the disabled control, the `holdMoved` refusal and the `holdEnded` note. I found no state where neither is shown.
- **Risk 4 (unused).** True. `noticesBesideRefusal` is consumed only to build view fields (`matchMove.ts:3657`, `restore.ts:4552`, `matchDuplication.ts:2577`) and in tests. No `.svelte` file references `tExternalConflictNotice` or `tExternalConflictAction`.
- **Risk 5 (tests).** Checked in `MatchEditor.test.ts` only. The EN and ES cases check that the disk text comes before the control, that `asked[0]` is `externalConflictSource(seen)` by identity, and that the reload reappears after a press with nothing adopted. They check all four refusals and exactly which note each one draws, that a refused press's sentence appears once, and that a no-uncertainty conflict gets no control. That is behaviour, not just a handler firing. The port is scripted, so the production port is covered only by `ReconciliationStatus.test.ts`, which I did not read.

## NOT-VERIFIED

- The mounted suites of the other seven renderers. I assumed they follow the same pattern because the diff sizes match.
- Whether `acknowledgementMintRefusal`'s `projectionReplaced` arm is reactive under `$derived`. It reads `holdRevision`, and I did not trace the projection generations.
- I did not re-run the test suites and relied on the orchestrator's results. I did not read the split-notes bullet or the phase record.
