Reviewer: autoclaude adversarial reviewer

# Phase 2d-5-2b-E — review of commit `0917cc3` (source half)

Scope: `src/lib/components/MatchCreator.svelte` (3 lines) and
`src/lib/components/DetailPane.test.ts` (1 line). Four comment lines, checked exhaustively.
`git show --numstat 0917cc3` reports `3 3` and `1 1` — line-count-neutral, as claimed, so this
commit cannot have shifted any citation in either file. Both hunks touch only `*`/`//` lines.

## The four corrected figures, re-derived against the tree

1. `workspace.svelte.ts:3328` is `const context: RestoreContext = {`; `3329` is
   `observed: revisionInProjection(views, session.target)`, `3330` is `surfaces`, `3331` is `};`.
   The range is exact. The enclosing method is `restoreDocument(started, surfaces, invalidate)`
   (`:3301-3305`), whose `surfaces` parameter is the pane's `now.context.surfaces` — so "rebuilds a
   `RestoreContext` around that very array … only `observed` is the coordinator's own read" holds.
2. `RestorePane.svelte:515` is `const answered = await restore(started, now.context.surfaces,
   invalidate);`. `:511` is `if (started === null) {`, the null guard. Correct in both directions.
3. `DetailPane.test.ts`: the sibling case's `lease()` is `:1110`, `flushSync()` `:1111`, then
   `expect` at `:1113`, `:1114`, `:1115` — **three**. `pane.stop()` (`:1116`) is not an assertion
   and is rightly excluded. Its introducing comment at `:1107` reads "The other half of the same
   claim", as quoted.
4. `RestorePane.svelte:106-111` sits inside the file-level header block (`:76-173`) and carries
   "One read of the window feeds every gate … `prepareRestore` and `confirmRestore` are handed the
   very same object" — the attributed claim. The docblock above `current` (`:323-331`) does not
   make it: it names one read of the world for view and context, never which reads gate the write.
   The re-attribution is right. The split sentence is grammatical and its claim true.

## Surrounding unchanged citations — all correct

`restore.ts` `:1993` (`competingSurfaceFor` in `restoreRefusal`, fn at `:1971`), `:2009`
(`canPrepareRestore`, `:2005`), `:2095` (in `prepareRestore`, `:2074`), `:2397` (in
`confirmRestore`, `:2375`), `:2581` (in `permitHolds`, `:2550`), `:2663` (in `sendRestore`,
`:2650`), `:3228` (`restoreRefusal` in `restoreView`, `:3203`). `RestorePane.svelte:340`
(`surfaces: surfaces()` inside `current`'s `$derived.by`), `:509`, `:510`. A full sweep of both
files for `file:NNN`, bare `` `:NNN` `` and "line N" forms found only one further citation,
`docs/reviews/phase-2d-5-design.md:45` at `MatchCreator.svelte:222` — that line is the Q1 ruling
("pass required reporting props where state lives inside a child") and the file is unchanged
since `5787e87`. No stale citation remains in either file.

## Recurrence condition (`2d-5-2b-notes.md` §16.5)

**Not met.** No figure corrected in 2d-5-2b-D is wrong again, and no citation in these two files
went stale for a second consecutive commit. No `BLOCKED` hatch.

## Findings

No blockers. No SHOULD-FIX. No NIT. The `:106-111` range ends mid-sentence (the sentence opened at
`:110` closes at `:112`), but it wholly contains the claim it is cited for, so this is recorded as
checked-and-correct, not a finding.

## NOT-VERIFIED

- The gate figures (1320 / 438 / 2254 / 186) were taken from the brief, not re-run: the diff is
  comment-only and touches no path under `crates/` or `src-tauri/`, and the Rust suite exceeds the
  budget.
- Whether the *prior* wording of the finding-4 sentence was the one the commit message quotes was
  not checked against history beyond this diff.
- The recorded coverage bound stands: no test in this repository pins any cross-file line citation,
  so every figure above is verified by reading only and can go stale on any later commit.
