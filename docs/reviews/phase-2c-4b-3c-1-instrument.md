# Verdict: NOT READY

## High

1. [2c-4b-3c-1-notes.md:63](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-4b-3c-1-notes.md:63)

   Exact sentence: “Six rows for five gaps, because Q7 point 6 says separately.”

   Why wrong: Q7 point 6 requires three distinct move-placement cases: reordered `top`/`end`, resolvable `after`, and an `after` anchor whose bytes changed and therefore refuses. The new table contains only the first two. `mover-changed` changes the target while choosing `top`; `creator-anchor` changes a creator anchor. Neither exercises a mover whose selected `after` anchor changed.

   This contradicts the title’s “whole Q7 matrix” guarantee and is not disclosed in §7. The record even quotes the missing requirement at lines 65–66 and then silently omits it.

   Concrete fix: add a mover `after`-anchor-changed refusal case, expected exactly R1 with no backup, retain its launch, and update all counts. Alternatively, remove every whole-matrix/completion claim and explicitly hand this missing instrument case to the next construction step—not to the reading step.

2. [2c-4b-3c-1-notes.md:1](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-4b-3c-1-notes.md:1), against [phase-2c-4b-design.md:144](/Users/ccarpio/Developer/espansoConfig/docs/reviews/phase-2c-4b-design.md:144)

   Exact sentence: “the instrument, extended to the whole Q7 matrix.”

   Why wrong: Q7 point 4 requires R1 either to remove the operation’s target or to change both its trigger and item bytes. The retained `target-changed-r1.yml` changes only `:beta`’s replacement; its trigger remains `":beta"`. `creator-anchor-gone` deletes a creator placement anchor, not the target of an editor/delete/duplicate/move operation. None of the 17 table rows supplies the required missing/changed-target shape.

   Concrete fix: add and launch the required target-deleted or trigger-plus-item-changed refusal case for the applicable target-bearing control, or explicitly document why a different retained case satisfies the exact Q7 wording. Until then, change “whole Q7 matrix” to bounded coverage and list this gap in §7.

## Medium

3. [2c-4b-3c-1-notes.md:279](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-4b-3c-1-notes.md:279)

   Exact sentences: “L27’s report says … its trigger is spelled the same on more than one snippet”; “L30’s and L34’s say … no snippet in that list carries the exact owned-run correspondence.”

   Why wrong: `reportReapply` retains only the first 300 characters. L27 ends at “spelled the same on”; L30 ends at “the exact owned”; L34 truncates even earlier in Spanish. The claimed endings are not in the retained transcripts. They may have been on screen, but that is explicitly unverifiable from the retained evidence.

   Concrete fix: restrict the record to the prefixes actually retained, or increase/remove the truncation and rerun the affected launches. Do not reconstruct unseen text from application-source knowledge.

4. [2c-4b-3c-1-notes.md:10](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-4b-3c-1-notes.md:10)

   Exact sentence: “four prove that the three surfaces with no Spanish launch at all, and the one with no Spanish positive, can now be launched in Spanish.”

   Why wrong: Step 3b says only two surfaces had no Spanish launch: creator and duplicator. Mover had no Spanish positive. L31–L34 comprise creator positive, duplicator positive, mover positive, and creator refusal; they do not cover three previously unlaunched surfaces. Section 5 later gives the correct accounting.

   Concrete fix: say “the two surfaces with no Spanish launch, the mover with no Spanish positive, and the creator’s anchor-refusal report.”

5. [launch.sh:32](/private/tmp/claude-501/-Users-ccarpio-Developer-espansoConfig/a95eea9d-1e3d-4344-9470-91a69a4e6e99/scratchpad/launch.sh:32)

   Exact code comment: “`R1` means the file must be byte-identical to what the second writer installed — a refusal wrote nothing.”

   Why wrong: the comparison proves only the final byte state. As both decision records correctly acknowledge, there is no invoke spy or command counter; an identical or transient write would produce the same artifacts. The harness comment reinstates the guarantee §7.0 and 3b §8.11 explicitly reject.

   Concrete fix: change it to: “`R1` means the expected final bytes are identical to the second writer’s file; this does not establish whether a save command was issued.”

6. [2c-4b-3c-1-notes.md:33](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-4b-3c-1-notes.md:33) and [2c-4b-3c-1-notes.md:152](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-4b-3c-1-notes.md:152)

   Exact sentences: “L01…L23 and all eight of 3b’s fixture files are untouched”; “Nothing else in the driver changed.”

   Why wrong: the retained tree contains no before-image or diff of the deliberately uncommitted driver and scratch files. Unchanged modification times do not prove unchanged content. These change-history claims are also absent from §6’s claim classes. They are unverifiable from the retained evidence.

   Concrete fix: qualify them as observations about timestamps/current source, or retain pre/post hashes or a patch and classify them as retained change-history evidence.

## Low

7. [2c-4b-3c-1-notes.md:149](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-4b-3c-1-notes.md:149)

   Exact sentence: “a new case … needs [a driver change] exactly when it presses a control the existing plan does not press.”

   Why wrong: `mover-after` did genuinely force the placement parameter, and the six naming arms were genuinely optional. But “exactly when” overgeneralizes from that case: future cases might need different field values, ordering, synchronization, logging, or assertions while pressing only previously used controls.

   Concrete fix: narrow it to this evidence: “`mover-after` needed a driver change because it had to select a placement the existing mover plan never selected.”

The byte evidence itself is sound: all three new positive expected files differ from R1 and matched the retained final files; the refusal/no-write cases matched R1 and had no backup directory. L26 distinguishes `alreadySatisfied` from the other outcomes only by its rendered sentence, not from a generic no-op mechanism—and §7.4 correctly admits that limitation.

Codex session ID: 019fe794-1430-72e3-a229-90bc4b0e79cb
Resume in Codex: codex resume 019fe794-1430-72e3-a229-90bc4b0e79cb
