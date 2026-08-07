# Phase 2c-4a step 3b — aggregate code review (Codex, round 1)

Job `task-msiyexgy-2qv9nt`, dispatched read-only against the uncommitted working tree over base
commit `59c8105`. The job could not create this file itself — the workspace was mounted read-only,
so its patch was rejected and no repository file was modified by the review. The text below is the
job's reply verbatim, copied here by the orchestrator.

---

The review is complete, but I could not create `docs/reviews/phase-2c-4a-3b-code.md`: the workspace is mounted read-only and `apply_patch` was rejected.

Findings:

1. **Medium:** `reloadClosesMover` falsely says every destination names snippets from the old revision. `top` and `end` name no snippet. See [en.json](/Users/ccarpio/Developer/espansoConfig/src/lib/i18n/en.json:330), [es.json](/Users/ccarpio/Developer/espansoConfig/src/lib/i18n/es.json:330), and [matchMove.ts](/Users/ccarpio/Developer/espansoConfig/src/lib/browser/matchMove.ts:1755).

2. **Medium:** `moveAfterSnippet` promises its anchor is “still marked as chosen,” but `movePlacementOptionsOf` removes old-revision anchors after a live reprojection while the conflict remains displayed. See [en.json](/Users/ccarpio/Developer/espansoConfig/src/lib/i18n/en.json:164), [MatchMover.svelte](/Users/ccarpio/Developer/espansoConfig/src/lib/components/MatchMover.svelte:300), and [matchMove.ts](/Users/ccarpio/Developer/espansoConfig/src/lib/browser/matchMove.ts:1809). The mounted test covers only a static projection.

3. **Low:** At confirmation, `reloadAbandonsOperation` and each surface-specific `reloadCloses*` sentence repeat the same close/abandon guarantee in different wording. They are currently consistent and reachable, but the duplication already allowed the mover’s narrower sentence to become false.

The widening itself is justified: it prevents operation-choice surfaces from claiming that typed text exists or can be copied. The raw editor, match editor, and creator remain byte-identical in rendered wording—the new branches select their previous message and label keys.

The reload transitions correctly treat `installed` and `alreadyThere` as success and stop only on `refused`. No forbidden conflict behavior was added, selection-generation writes remain sound, and the new tests are not vacuous; their weakness is missing mover placement/reprojection coverage.

**NOT READY — blocking findings: Medium 1 and Medium 2.**

Codex session ID: 019fdc50-cee8-7f40-b162-6b6436482d69
Resume in Codex: codex resume 019fdc50-cee8-7f40-b162-6b6436482d69

---

# Phase 2c-4a step 3b — confirmation pass over the fix round (Codex, round 2)

Job `task-msizd5ho-yzd3t6`, dispatched read-only against the uncommitted working tree after round
1's three findings were fixed, over the same base commit `59c8105`. As in round 1 the job could not
create or modify any repository file. It was scoped to one question — whether the fixes closed the
findings and whether they introduced anything — because **a fix is a change, and the round that
reviews it is not optional**: round 1's fix rewrote and renamed five user-facing strings, changing
rendered wording on four surfaces that were the subject of no finding. The text below is the job's
reply verbatim, copied here by the orchestrator.

---

## Round 2 — confirmation pass

### Findings

None.

### Confirmation

1. Prior finding 1 is closed. `reloadWarning` is derived from the retained conflict placement, not the current draft: `after` selects `anchoredDestination`, while `top` and `end` select `positionalDestination` (`src/lib/browser/matchMove.ts:1833`, `src/lib/browser/matchMove.ts:2203`). The English and Spanish positional sentences name a position rather than a snippet, while only the anchored sentences name another snippet (`src/lib/i18n/en.json:331`, `src/lib/i18n/en.json:332`, `src/lib/i18n/es.json:331`, `src/lib/i18n/es.json:332`). `MatchMover` renders exactly that model arm during confirmation (`src/lib/components/MatchMover.svelte:797`).

2. Prior finding 2 is closed. `operationOf` returns `moveAfterSnippet` only when `movePlacementOptionsOf` itself contains the retained placement with `chosen: true`; otherwise it returns `moveAfterSnippetNoLongerShown` (`src/lib/browser/matchMove.ts:1766`, `src/lib/browser/matchMove.ts:1798`). The component derives the view and rendered options from one read of the same projection array (`src/lib/components/MatchMover.svelte:301`). Consequently, the “marked as chosen above” wording is gated by the actual displayed mark (`src/lib/i18n/en.json:164`, `src/lib/i18n/es.json:164`), while the other arm no longer attributes every disappearance specifically to a reread (`src/lib/i18n/en.json:165`, `src/lib/i18n/es.json:165`).

3. Prior finding 3 is closed. `reloadWarningFor` is the sole model decision for the close/abandon/no-write guarantee and distinguishes authored text from operation choices (`src/lib/browser/saveOutcome.ts:630`). The shared English and Spanish messages contain the clauses removed from the surface-specific lines (`src/lib/i18n/en.json:148`, `src/lib/i18n/en.json:149`, `src/lib/i18n/es.json:148`, `src/lib/i18n/es.json:149`). The editor, creator, deleter and duplicator lines are gated only at the confirmation step and now state surface-specific consequences and next steps (`src/lib/components/MatchEditor.svelte:830`, `src/lib/components/MatchCreator.svelte:751`, `src/lib/components/MatchDeleter.svelte:512`, `src/lib/components/MatchDuplicator.svelte:698`). Their English and Spanish wording makes no additional close, abandon or write guarantee (`src/lib/i18n/en.json:225`, `src/lib/i18n/en.json:265`, `src/lib/i18n/en.json:303`, `src/lib/i18n/en.json:367`, `src/lib/i18n/es.json:225`, `src/lib/i18n/es.json:265`, `src/lib/i18n/es.json:303`, `src/lib/i18n/es.json:367`).

4. The renamed keys are fully migrated in executable source, tests and both dictionaries. The only old mover-key occurrence is an explicitly historical “now gone” comment, not a lookup or asserted live key (`src/lib/browser/saveOutcome.ts:619`).

5. The mounted reprojection test is falsifiable and exercises the claimed production path. It mounts `MatchMover` over a real reactive `BrowserState`, creates an anchored conflict, verifies the marked destination and old summary, calls `state.rereadDocument`, verifies that only top/end remain, and then requires the summary arms to swap (`src/lib/components/MatchMover.test.ts:1069`, `src/lib/components/MatchMover.test.ts:1142`, `src/lib/components/MatchMover.test.ts:1148`, `src/lib/components/MatchMover.test.ts:1152`, `src/lib/components/MatchMover.test.ts:1156`).

6. The forbidden conflict behavior remains absent. Conflict choices contain no `saveAnyway` (`src/lib/browser/saveOutcome.ts:216`, `src/lib/browser/saveOutcome.ts:352`), and mover, deleter and duplicator retain `offersCopyDraft: false` (`src/lib/browser/matchMove.ts:1737`, `src/lib/browser/matchDeletion.ts:819`, `src/lib/browser/matchDuplication.ts:1173`). The confirmed mover reload adopts the disk observation and closes only after successful adoption; it neither retries the stale move nor carries its placement forward (`src/lib/browser/matchMove.ts:1588`, `src/lib/browser/matchMove.ts:1603`).

**VERDICT: READY — no blocking findings.**

Codex session ID: 019fdc69-29d1-7043-a2d4-23611518e657
Resume in Codex: codex resume 019fdc69-29d1-7043-a2d4-23611518e657
