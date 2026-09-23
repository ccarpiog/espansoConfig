# Review brief — Phase 2d-6-9b-2

- **Repo:** /Users/ccarpio/Developer/Utils/espansoConfig (macOS Tauri v2 app; Svelte 5 / TypeScript frontend). Review the **uncommitted** working tree against `HEAD` (`76c4dbb`).
- **Review file:** `docs/reviews/phase-2d-6-9b-2.md`
- **Time budget:** 15 minutes.

## Phase and goal

2d-6-9b-2: the eight write renderers (`MatchEditor`, `MatchCreator`, `RecoveryPanel`, `MatchDeleter`,
`MatchMover`, `MatchDuplicator`, `RawEditor`, `RestorePane` `.svelte`) gain **only** typed status and
acknowledgement presentation: a snapshot acknowledgement ("I have reviewed this snapshot") minted from the
panel's own `model.source`, drawn through the sessions' `acknowledgeSnapshot` / `acknowledgeRestoreSnapshot`,
with EN/ES words via typed accessors, bilingual mounted tests. The held and unknown-outcome sentences are
drawn once above each panel by `DetailPane`'s file-status block; a renderer must not draw them again (the
worker found they were drawn twice and removed the panels' copies). Also records the orchestrator's entry-15
ruling as a new `2d-6-9b-3` bullet in `docs/decisions/2d-6-split-notes.md` §2 (not implemented here).

Scope and binding rules: `docs/decisions/2d-6-split-notes.md` §2 (`### 2d-6-9`, the cut of 9b), §3 entries
13-18, 26-32, 34-40; `docs/decisions/2d-6-9b-1-notes.md` §6; the phase record
`docs/decisions/2d-6-9b-2-notes.md`. Project rules: `CLAUDE.md` (esp. §2 i18n, §5 "no comment claims a
guarantee the code does not force", §6 invariants).

## Changed files

`git status --short` — everything except the four instrument paths (`src-tauri/src/main.rs`, `src/main.ts`,
`src-tauri/src/probe.rs`, `src/probe.ts`), which are a deliberate uncommitted instrument and **out of scope**.
New: `src/lib/components/SnapshotAcknowledgement.svelte`, `docs/decisions/2d-6-9b-2-notes.md`. Modified: the
eight renderers and their tests, `DetailPane.svelte`, `ReconciliationStatus.test.ts`,
`src/lib/browser/{reconciliationStatus.ts,reconciliationStatus.test.ts,fixtures.ts,observationDelivery.ts}`,
eight session modules (comments only, claimed), `src/lib/i18n/{en,es}.json`, `codes.ts`, `index.ts`, two i18n
suites, the split notes.

## Verification already run (orchestrator)

`npm test` exit 0 (3357 passed, 69 files); `npm run check` exit 0 (457 files, 0 errors, 0 warnings);
`npm run build` exit 0 (200 modules); server-only bundle markers absent, client-only present. No Rust changed.

## Risks to probe

1. Does each of the eight acknowledgements mint from the panel's **own** `model.source` and reach the right
   session function, or could a press acknowledge an origin other than the one drawn beside it?
2. Is the enabled/disabled decision correct, and does the disabled-state wording state the **real** exits
   (the worker claims the only exit is a further change to the file)? Any false guarantee in a comment or
   sentence?
3. Removing the panels' own held/unknown-outcome sentences: is any case left where a panel now shows
   neither (e.g. a panel mounted without the pane's block, or a state the pane's block does not cover)?
4. Comments marking `noticesBesideRefusal`, `tExternalConflictNotice`, `tExternalConflictAction` as unused —
   true?
5. Mounted tests: do they prove the behaviour (EN and ES) or only that a handler fires?
