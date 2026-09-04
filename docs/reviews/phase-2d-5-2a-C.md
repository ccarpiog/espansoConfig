Reviewer: autoclaude adversarial reviewer

# Review — Phase 2d-5-2a-C (round 4)

**Did this fix round create a fourth generation of the same shape? Yes — once, in the record
only, and it is the same shape as finding 3, in the document that fixes finding 3.**

## SHOULD-FIX

**1. `docs/decisions/2d-5-2a-C-notes.md:271` — "the shipped module has no `kind` route at all"
is true of `replaceTarget` and false of the module.** §7 item 2 justifies its *recorded only*
mark with that clause. The shipped `registerWriteSurface` reads the caller's `surface.kind` at
`writeSurfaceRegistry.ts:503` (`const kind = surface.kind;`) — and §4.2 of this same file, at
`:176-179`, says exactly that: *"Both read `surface.kind` off the caller's object in
`registerWriteSurface` … the current file's `:503`"*. The two sentences contradict each other.
The consequence is substantive, not cosmetic: the non-termination limit item 2 attributes to
the old module also holds for the shipped one, because a `surface.kind` accessor that re-enters
`registerWriteSurface` unconditionally recurses there too. Scope the clause to
`replaceTarget`. The *recorded only* mark itself survives — it still names no source defect.

**2. `2d-5-2a-C-notes.md:247-249` (§6 item 4) attributes `workspace.svelte.ts:3210-3217` to
"`2d-5-2a-B-notes.md` §1's table".** That table (`2d-5-2a-B-notes.md:29-30`) carries three
workspace ranges; `:3210-3217` is at `2d-5-2a-B-notes.md:167`, in §3. The new correction block
at `2d-5-2a-B-notes.md:41-43` lists the three, so the two lists of "every other citation"
disagree. No line number is wrong; the attribution is.

## Verified, not findings

Every citation in the diff and the new record re-derived on the post-edit tree: registry
`:503`, `:504`, `:538`, `:555`, `:568`, `:572-574`, `:241-250`, `:258-260`, `:388-396`,
`:421`, `:423-434`, `:495-502`, 605 lines (597 at `5ec011e`); `workspace.svelte.ts` `:1689`,
`:1703`, `:1721`, `:1722`, 3730 lines; `15ada19` `:302-309`, `:365`, `:368`, `:399`, `:410`,
`:411`, and `.document` absent (exit 1); `restore.ts:379`; `writeSurfaceRegistry.test.ts:520-544`
pins row 1. §5's three reviewer imprecisions all hold. §3.3's four rows are correct under both
orderings, including every generation delta. The new comment `:555-568` is true of both cases
and its scope is explicit, not merely longer. Marks in §7 item 3 (coverage gap, not a source
correctness defect → not a blocker) and item 2 (recorded only) are correct under §7.3, item 2
only once finding 1 above is applied.

## Not verified

Gates not re-run (orchestrator-supplied). `docs/reviews/phase-2d-5-2a-B.md:17,34` and
`PROGRESS.md:316,626` still cite `:555-557`/`:566-574`; treated as historical snapshots of
`5ec011e`, not staled records — orchestrator's call.
