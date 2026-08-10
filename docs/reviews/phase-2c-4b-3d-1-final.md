NOT READY

## Findings

### Low — The request-language sweep still leaves “revealed” as an achieved postcondition in reapply prose

The model contract still says **“Every arm is revealed”**, and its exhaustive-switch comment says a
future arm decides whether its report **“is revealed”** (`src/lib/browser/reapply.ts:596`,
`src/lib/browser/reapply.ts:655`). The corresponding test retains the closing label **“every arm is
revealed”** (`src/lib/browser/reapply.test.ts:421`). Those statements sit beside the corrected contract
that a model or mounted test can establish only the cue, binding, and call, while only 3d-2 can establish
that a person sees the report (`src/lib/browser/reapply.ts:631`,
`src/lib/browser/reapply.test.ts:394`). They are therefore narrower instances of round 2 finding 1,
not harmless shorthand: `scrollQuietly` may return when `scrollIntoView` is absent or swallow its
exception (`src/lib/components/reveal.ts:74`, `src/lib/components/reveal.ts:79`). The decision record's
claim that the shape sweep rewrote the reapply prose to requests, and that all 82 identified sentences
now make only request claims, is consequently too broad (`docs/decisions/2c-4b-3d-1-notes.md:652`,
`docs/decisions/2c-4b-3d-1-notes.md:662`, `docs/decisions/2c-4b-3d-1-notes.md:668`).

## Answers to the specific questions

### 1. Are round 2's two findings closed?

Finding 1 is not completely closed. The outcome tests, mounted-suite names, and the principal model and
DOM contracts now consistently describe a request—for example, `revealOutcome` says **“Asked for, not
achieved”** (`src/lib/components/reveal.ts:86`, `src/lib/components/reveal.ts:96`), and the mounted Raw
Editor cases say **“asks for”** (`src/lib/components/RawEditor.test.ts:1006`,
`src/lib/components/RawEditor.test.ts:1030`). The narrower reapply statements identified in the Low
finding still state the result as achieved.

Finding 2 is closed. The record and production JSDoc now place the deleter confirmation and mover
destinations before their reports and explicitly leave the success-path direction unmeasured
(`docs/decisions/2c-4b-3d-1-notes.md:283`, `src/lib/browser/reapply.ts:608`). Section 7 defines item (f)
for every match surface in both languages and assigns it to Editor, Creator, Deleter, Mover, and
Duplicator (`docs/decisions/2c-4b-3d-1-notes.md:463`,
`docs/decisions/2c-4b-3d-1-notes.md:477`, `docs/decisions/2c-4b-3d-1-notes.md:481`).

### 2. Is the widening into `saveOutcome.ts` and the six outcome comments correct, complete, and recorded?

Yes, for those named sites. `OutcomeReveal` now describes its five values as no request, a request for
the first line of each of the three panel arms, or a request for the conflict controls
(`src/lib/browser/saveOutcome.ts:1649`, `src/lib/browser/saveOutcome.ts:1677`). That matches
`revealOutcome`: the three panel cues call `scrollQuietly` with the panel and `block: 'start'`, the
choices cue calls it with the choices (falling back to the panel) and `block: 'end'`, and `none` returns
without a call (`src/lib/components/reveal.ts:111`, `src/lib/components/reveal.ts:116`,
`src/lib/components/reveal.ts:119`, `src/lib/components/reveal.ts:126`). The request language therefore
does not understate a guarantee: the implementation deliberately cannot know whether the platform
moved anything (`src/lib/components/reveal.ts:59`, `src/lib/components/reveal.ts:64`).

All six component comments use the same accurate formulation—**“appearance asks for a scroll into
view”**—and each effect actually calls `revealOutcome` (for example,
`src/lib/components/MatchEditor.svelte:298`, `src/lib/components/MatchEditor.svelte:314`, and
`src/lib/components/RawEditor.svelte:210`, `src/lib/components/RawEditor.svelte:226`). The widening is
explicitly disclosed as a doc-only sweep outside the original reapply mechanism in the file inventory
and in §11.1, including `saveOutcome.ts`, all six write surfaces, the 18-file count, and the consequence
for RawEditor (`docs/decisions/2c-4b-3d-1-notes.md:34`,
`docs/decisions/2c-4b-3d-1-notes.md:39`, `docs/decisions/2c-4b-3d-1-notes.md:641`). It is not smuggled,
although the separate behavioural scope addition remains the success-arm policy identified in §3.6
(`docs/decisions/2c-4b-3d-1-notes.md:264`).

### 3. Is the three-way scroll-direction rule correct, and who is right?

The fixer is right; the orchestrator's proposed blanket opposite direction would also have been too
strong. The actual markup puts the deleter confirmation before its report
(`src/lib/components/MatchDeleter.svelte:464`, `src/lib/components/MatchDeleter.svelte:516`) and the
mover destinations before its report (`src/lib/components/MatchMover.svelte:663`,
`src/lib/components/MatchMover.svelte:779`). For the report sizes at issue,
`scrollIntoView({ block: 'nearest' })` aligns a below-scrollport report bottom-to-bottom, moving earlier
content up; aligns an above-scrollport report top-to-top, moving earlier content down; and does not
scroll a fully visible report. The code requests exactly `nearest` (`src/lib/components/reveal.ts:164`),
and the success geometry has not been measured, so the three-way rule in the production JSDoc and §3.6
is the honest rule (`src/lib/browser/reapply.ts:614`,
`docs/decisions/2c-4b-3d-1-notes.md:292`).

### 4. Is RawEditor's new 3d-2 obligation propagated everywhere?

Yes. The inventory now says that `RawEditor.svelte` changed only in its two outcome comments and
explicitly derives a renewed window-reading obligation from that component change
(`docs/decisions/2c-4b-3d-1-notes.md:36`, `docs/decisions/2c-4b-3d-1-notes.md:41`). Section 7 says every
listed component changed and includes a RawEditor row, while correctly excluding item (f) because
RawEditor draws no reapply report (`docs/decisions/2c-4b-3d-1-notes.md:457`,
`docs/decisions/2c-4b-3d-1-notes.md:482`). That is consistent with the component: its conflict choice
switch has no callable reapply path and its outcome effect is the ordinary save-outcome effect
(`src/lib/components/RawEditor.svelte:367`, `src/lib/components/RawEditor.svelte:222`).

### 5. Is anything else in the decision record false, contradictory, or unsupported?

Apart from §11.1's overstatement that the visual-postcondition sweep is complete, identified in the
Low finding, I found no further false or self-contradictory current claim in the scoped fix-round
record. The dictionary totals are consistently fourteen values over eleven keys, with nine only the
Spanish-register subset (`docs/decisions/2c-4b-3d-1-notes.md:10`,
`docs/decisions/2c-4b-3d-1-notes.md:503`). The record also consistently distinguishes the unchanged
outcome-reveal bodies from their reworded contracts (`docs/decisions/2c-4b-3d-1-notes.md:508`) and
assigns the success-arm observation to 3d-2 rather than claiming it as measured
(`docs/decisions/2c-4b-3d-1-notes.md:498`).
