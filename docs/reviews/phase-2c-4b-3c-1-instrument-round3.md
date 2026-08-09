# NOT READY

Round 3 was scoped to the three edits that closed round 2's High and Medium plus one instance
found by sweeping. It found three further narrower instances of the same claim — one of them
introduced by the round-2 fix itself.

1. [2c-4b-3c-1-notes.md:12](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-4b-3c-1-notes.md:12)

   Exact sentence: "Q7 point 6 asks for **three** move-placement shapes and the first draft built two…"

   Why wrong: point 6 also requires `end` after reorder, which remains unbuilt. This sentence still
   presents three shapes as exhaustive.

   Concrete fix: enumerate the three built shapes and explicitly state that `end` after reorder
   remains for the next construction step.

2. [2c-4b-3c-1-notes.md:208](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-4b-3c-1-notes.md:208)

   Exact text: "Q7 point 6's third placement shape"

   Why wrong: `mover-after-changed` is the third shape built here, not point 6's final or exhaustive
   third shape.

   Concrete fix: change it to "Q7 point 6's changed-anchor placement shape."

3. [2c-4b-3c-1-notes.md:396](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-4b-3c-1-notes.md:396)

   Exact sentence: "Point 6 names `top`/`end`; only `top` was built, so point 6's third placement
   shape is unbuilt…"

   Why wrong: three shapes were built — `top` after reorder, resolvable `after`, and changed-anchor
   `after`. Calling the remaining `end` case the "third" shape contradicts that accounting.

   Concrete fix: replace "point 6's third placement shape" with "the remaining `end`-after-reorder
   variant."

The new §2.5 opening and the eight-row `launch.sh` comment are consistent.

Note on provenance: rounds 1 and 2 ran as background Codex jobs and their text was placed here from
`codex-companion.mjs result`. Round 3 ran synchronously and returned inline; this file is that reply,
transcribed, with the scope paragraph above added by the orchestrator.
