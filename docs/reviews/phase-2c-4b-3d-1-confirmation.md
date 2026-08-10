NOT READY

## Findings

### Low — The movement-claim sweep still leaves the same unconditional postcondition in test prose

`revealReapplyReport`, `revealOutcome`, and `scrollQuietly` now state the right contract: they ask the
platform to scroll, the missing-method and throwing arms are silent, and only an honouring platform
can provide the stated movement (`src/lib/components/reveal.ts:57`,
`src/lib/components/reveal.ts:63`, `src/lib/components/reveal.ts:86`,
`src/lib/components/reveal.ts:96`, `src/lib/components/reveal.ts:145`,
`src/lib/components/reveal.ts:150`). Section 3.3 puts the same condition in the sentence that makes
the movement claim (`docs/decisions/2c-4b-3d-1-notes.md:186`). The High is therefore closed at both
contract sites.

The sweep is not complete, however. The same test file still describes the three outcome cues as
meaning “put the panel's first line at the top” and names its cases “puts ... in view”
(`src/lib/components/reveal.test.ts:34`, `src/lib/components/reveal.test.ts:88`,
`src/lib/components/reveal.test.ts:106`). Those cases install a spy, so they prove only the call and
its arguments; they do not prove movement, exactly as the newly corrected reapply-report block now
explains (`src/lib/components/reveal.test.ts:152`, `src/lib/components/reveal.test.ts:163`). The five
mounted suites retain the same narrower claim in their suite/case names—for example
`src/lib/components/MatchEditor.test.ts:1413`, `src/lib/components/MatchEditor.test.ts:1457`, and
`src/lib/components/MatchEditor.test.ts:1467`—even though their shared premise correctly says a
mounted case proves only binding and execution (`src/lib/components/MatchEditor.test.ts:1422`). The
new comments on the reapply cases are honest, but the adjacent pre-existing test prose is the same
unconditional visual postcondition the sweep says it removed. Reword these sites as requests/calls,
as the contracts now are.

### Low — The new success-path cost is described backwards and the 3d-2 matrix does not measure the widening over all five components

The decision to reveal every report arm is reasonable: limiting the cue to the refusal arms would
recreate the unseen-report class for `reapplied` and `alreadySatisfied`, and the exhaustive switch
keeps that policy in one place (`src/lib/browser/reapply.ts:595`,
`src/lib/browser/reapply.ts:628`). But the newly added price says a success-path reveal moves content
“below the report” down, identifying the deleter's renewed confirmation and the mover's rebuilt
destinations (`src/lib/browser/reapply.ts:607`,
`docs/decisions/2c-4b-3d-1-notes.md:278`). Both named controls are actually rendered **before** the
report: the deleter confirmation is at `src/lib/components/MatchDeleter.svelte:464` and its report at
`:516`; the mover destinations are at `src/lib/components/MatchMover.svelte:663` and its report at
`:779`. On the unmeasured success layout, `nearest` may scroll in either direction depending on where
the rebuilt report lands; the refusal-only geometry cannot establish that these earlier controls are
pushed down by the report's height.

Section 7 repeats that unsupported direction and assigns successful-reapply checks only to those two
surfaces (`docs/decisions/2c-4b-3d-1-notes.md:441`,
`docs/decisions/2c-4b-3d-1-notes.md:442`). Yet the widening runs on both success arms in all five
components, and its rationale is specifically that their success reports must not remain unseen
(`src/lib/browser/reapply.ts:595`, `src/lib/browser/reapply.ts:614`). The table gives Editor, Creator,
and Duplicator only refusal-path reveal checks (`docs/decisions/2c-4b-3d-1-notes.md:439`,
`docs/decisions/2c-4b-3d-1-notes.md:440`, `docs/decisions/2c-4b-3d-1-notes.md:443`), so it never asks
3d-2 to establish that either success report is visible there. Correct the cost to describe the
controls' actual order and unknown success geometry, and require 3d-2 to read the success-arm report
and the next usable controls on every match component the widening changed, in both languages. The
deleter and mover deserve their component-specific confirmation/destination checks, but they are not
the whole success-path surface.

## Answers to the four questions

### 1. Are the three findings closed?

Not completely. The unconditional movement guarantee is fixed in `revealReapplyReport`'s JSDoc,
§3.3, and the `revealOutcome`/`scrollQuietly` contracts, but the same unconditional postcondition
survives more narrowly in test prose (first Low above). The widening is now disclosed and its central
argument is sound, but its newly documented cost and verification sweep are incomplete (second Low).
The dictionary-inventory finding is closed.

### 2. Did a fix introduce a new false or overreaching claim?

Yes. The new success-path rationale says the deleter confirmation and mover destinations sit below
the report and are pushed down by its height. The markup puts both before the report, and no success
window reading yet establishes the direction or distance of the `nearest` scroll. The newly added
reapply test comments themselves correctly distinguish a request from achieved movement; the false
test prose identified above is the narrower pre-existing instance the sweep left behind.

### 3. Are the dictionary counts correct?

Yes. Re-derived from the dictionary diff: English changes three values—`differentMatch`, `gone`, and
`fieldCollisions`. Spanish changes eleven values—the same three plus nine register strings, with
`fieldCollisions` belonging to both Spanish sets, so `3 + 9 - 1 = 11`. That is fourteen localized
values over eleven distinct keys. Nine is only the Spanish register subset. A whole-word, case-insensitive
search for `usted` in `src/lib/i18n/es.json` has no matches; the two remaining raw substring hits are
inside the key names `batchNameExhausted` and `backupNameExhausted`, not localized prose.

### 4. Is §7 complete and accurate for every changed component?

No. Its refusal-path checks and the component-specific language checks are appropriate, and retaining
RawEditor in the reading is conservative. Its new success-path item is inaccurate about DOM order and
covers only Deleter and Mover. Because `reapplyReveal` was deliberately widened for both success arms
on Editor, Creator, Deleter, Mover, and Duplicator, 3d-2 must observe the success report and the next
usable controls on all five in both languages; otherwise the widening's own claimed benefit and cost
remain unmeasured on three components.
