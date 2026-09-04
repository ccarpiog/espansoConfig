Reviewer: autoclaude adversarial reviewer

# Phase 2d-5-2a-B — adversarial review

## Blockers

None. The scope bound holds (every added line under `src/` is inside a comment), and no claim I
re-derived against the code is false in the direction that matters.

**Re-derived independently, not taken from the notes.** `git show 15ada19:…/writeSurfaceRegistry.ts
| grep -n '\.document'` returns nothing (exit 1) — the old module never read `target.document`, so
the worker's deviation (1) stands and the review's mechanism does not. `:411` is
`if (heldBy(kind, serial) !== held) {`; `:404` is a comment line — deviation (2) stands. Old
`withTarget` (`15ada19:302-309`) reads `held.surface.kind` off the object old
`registerWriteSurface` (`:368`) stored **by reference**, so row 3 of §2.4 is the real old route and
its old outcome (`'staleLease'`, inner target installed) follows from the two-check code. Row 2's
new outcome follows from `writeSurfaceRegistry.ts:566-574`: a replacement keeps the serial, `heldBy`
matches, the outer writes last — both calls answer `'replaced'`. Row 1's old answer is `'replaced'`
because the accessor never fires in old code. The `@throws` text matches `ownedSurface:423-434`
exactly, and `OpenWriteSurface` (`restore.ts:423-435`) does correlate kind and arm, so
"unreachable from a well-typed literal" is true. `:427-449` does assert generation and both
transitions unmoved. Line counts 597 / 3730 and all citations at `:241-250`, `:258-260`, `:412-416`,
`:421`, `:495-502`, `:538-560`, `:106-120`, `:1477-1530`, `:1502-1514`, `:1520-1525`, `:3210-3217`,
`:2305-2310`, `:1703`, test `:520-544` re-derived correct on this tree.

## Should fix

**1. `docs/decisions/2d-5-2a-A-notes.md` correction 2 and `2d-5-2a-B-notes.md:201` — a fresh
off-by-one citation, in the fix answering the stale-citation finding.** Both say "the replacement
comment block runs `:1690-1721`". `grep -n` puts its first line — `// **Every write surface this
window has told this state about** — Phase 2d-5-2a.` — at **1689**; 1690 is the second line. The
block is `:1689-1721`. Record-only.

**2. `src/lib/browser/writeSurfaceRegistry.ts:555-557` — the new comment generalises the old route
it was written to describe precisely.** *"its own re-entry route was a `kind` accessor … and on that
route it answered `staleLease` for a lease that was live."* True only when that accessor re-entered
with a same-lease `replaceTarget`; a re-entrant **registration** through the same accessor took a new
serial, so the old code's `staleLease` was correct there. `2d-5-2a-B-notes.md` §2.4 row 3 is scoped
("`replaceTarget` on the same lease"); the comment is not. Source — a fix commissions a round.

**3. `2d-5-2a-B-notes.md` §2.3, *"So the two orderings share no re-entrancy route."*** True of
`replaceTarget`. Both orderings read `surface.kind` in `registerWriteSurface`
(`15ada19:365` and `:503`), which is a shared route; the sentence is unscoped.

## Judged, not a finding

- §6 item 1's *actionable, not a blocker* mark is correct: it names an absent test case, not a wrong
  line in source, so §7.3 permits carrying it.
- §6 item 4 (`'replaced'` is point-in-time) is a genuine limit of
  `WriteSurfaceTargetReplacement:106-120` and *recorded only* is defensible — a sequential second
  `replaceTarget` has the same property.
- The `replaceTarget` comment names two re-entry cases; a re-entrant `unregister` is a third, also
  `staleLease`. It does not claim to be exhaustive, so this is not a false sentence.

## Not verified

- The harness measurement §2 rests on ("both modules transpiled and run against each other") is
  outside the repository and was not reproduced; I derived every table cell by reading both modules
  instead, and agree with all six.
- The *"7 of 28 fail"* discrimination count — same reason as review 2: checking it means writing a
  tracked source file.
- The four gates and both bundle oracles — not re-run; the brief reports them at exit 0 and the diff
  is comment-only.
- `PROGRESS.md` is not in this diff; whether the phase record and SHA land there is the
  orchestrator's step, unreviewed here.
- Nothing registers a surface in production, so the `@throws` paragraph's mount-path hazard remains
  unfalsifiable until 2d-5-2b's mounted evidence.
