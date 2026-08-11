# Confirmation review — Phase 2c-4b step 3d-2b

## Findings

### 1. Low — the record calls measurements from two launches “the same event”

- **Record:** `docs/decisions/2c-4b-3d-2b-window-reading.md` §4, lines 348–350.
- **What the record claims:** P12's 114 px displacement of the outcome panel and P66's 114 px pane movement are “the same event seen from the two ends.”
- **What the artifact shows:** P12 and P66 are separate launches, on separate binaries. P12 observes the uninstrumented first-round transition; P66 is the instrumented re-take. Their equal magnitudes reproduce the same transition shape, but they cannot be two observations of one event. The causal conclusion does not need this pairing: P66 alone records one application-issued `block:nearest` call on the report, synchronously paired with `delta=-114` and `rect=-70->44`. The source search also leaves `revealReapplyReport` as the only production path that calls `scrollQuietly` with `'nearest'`, and each match component calls that function from its reveal effect. That is enough to attribute the observed request and movement to `revealReapplyReport` on P66; the single-call observation is not merely “any reveal on the path.”
- **Minimal correction:** replace “the same event seen from the two ends” with “the same 114 px transition shape reproduced across the first launch and its instrumented re-take,” or remove the P12 comparison and rest the causal statement on P66's paired `delta` and `rect` fields.
- **What is written to a user's file:** this is a record-description defect only. It does **not** touch what is written to a user's file.

### 2. Low — “decision” and “the platform runs it without refusing it” exceed what the spy observes

- **Record:** `docs/decisions/2c-4b-3d-2b-window-reading.md` §1.4, lines 139–153; §5.3, lines 472–476; §9.1, lines 657–667; §17, lines 1109–1113. The tension is acknowledged correctly in §15 item 11, lines 1044–1047.
- **What the record claims:** a zero delta with available scroll range is a platform “decision”; the transcript “proves” that decision; and on the second press the platform “runs [the request] without refusing it,” correctly declining to move the already-visible report.
- **What the artifact shows:** P54/P55/P64/P65 and P66–P75 establish exactly one application-issued `block:nearest` request, `threw=false`, unchanged target `top`, and `delta=0`. On the second presses, the unchanged `max` and a `top` strictly inside the allowed range exclude a range clamp. The report is already in the scrollport, so no movement is also the outcome the `'nearest'` algorithm specifies. But `src/probe.ts:270–276` and record §1.4 bound 1 correctly say the wrapper never observes the platform's internal decision. In particular, `threw=false` means the native call returned without throwing; it does not by itself distinguish an honoured specified no-op from a silent ignore. Calling the zero a “decision” is also unnecessary: the important measured distinction is **no request-caused movement despite available range**, not an observed internal choice. This does not make `delta=0` surprising or defective, and it does not reopen either movement question.
- **Minimal correction:** call this the **specified no-movement outcome, not a range clamp**. Say that the request returned without throwing and produced no movement while the report was already in view. Remove “the transcript proves” a platform decision and replace “the platform runs it without refusing it” / “correctly declines” with wording that does not claim an internal state. Keep the sound conclusion that the application re-issued the request and that the request caused no movement.
- **What is written to a user's file:** this is an evidence-scope defect in the record only. It does **not** touch what is written to a user's file.

### 3. Low — §17 restores the stale “eighteen” count after §4 corrects it to 42

- **Record:** `docs/decisions/2c-4b-3d-2b-window-reading.md` §17, lines 1094–1096, against §4, lines 283–287.
- **What the record claims:** the final verdict says 3c-2 measured the refused report above the band in eighteen launches.
- **What the artifact shows:** §4 correctly records that 3c-2 §9 and §11.1 both say **42** `manualResolution` launches and explicitly identifies 18 as the stale `PROGRESS.md` value. The final verdict then repeats that stale value. Nothing in the fix round changes the historical count.
- **Minimal correction:** change “eighteen” to “42” in §17.
- **What is written to a user's file:** this is a stale numeric fact in the record only. It does **not** touch what is written to a user's file.

## Confirmation of the fix round

The two formerly unobservable questions are now measured at the right layer. P54–P65 separate the editor's layout-range clamp from the subsequent reveal call: the pane is already at the new `max` when the wrapped native call begins, and that call has `delta=0`; on the four operation surfaces the record correctly limits `delta=0` to “no range existed.” P66–P75 record one second-press application request in every language/surface pair. Subject to finding 2's internal-state wording, §14 may therefore say both that no case-row coverage gap remains and that every fact §7 requests has now been measured.

The observer-effect bound in §1.4 and §15 item 12 is stated at the right strength. The record admits that the pre-call reads force layout earlier, says the matching success rectangles are only consistent with no effect, and does not use that reproduction as proof of no observer effect. The movement verdict necessarily uses the instrumented measurements, but the native `scrollIntoView` call itself must operate on current layout; forcing that layout synchronously immediately before the call does not make the recorded direction or zero delta unsupported. No additional correction is required for this bound.

The other four round-one corrections are sound:

- §12 now reaches only the supported confounding conclusion. The 925/908/908/925 creator sequence establishes between-launch instability without excluding either historical candidate cause; the 741 repeats support only the narrower statement that instability was not universal in the sampled cases. No other verdict is made to depend on conflict-panel height.
- §7 and F5 now agree with `2c-4b-3d-1-notes.md` §4.2: one disjunctive sentence and one recovery are deliberate, overlapping causes prevent unsupported attribution, and 3d-1's truthfulness fix is delivered.
- F1's Low grade is grounded in the block being informational, reachable by scrolling, and confined to the editor. The 3c-2 citation is now provenance/non-regression only.
- §15 now carries the five holes, the request/platform distinction, the layout-flush observer effect, the operation surfaces' range-zero limitation, and the still-unobservable second reapply transition. I found no narrower recurrence of round-one finding 5.

Recording rather than regenerating the two older manifests is the correct preservation choice. Their 45/46 and 130/131 states disclose the deliberate `src/probe.ts` change instead of rewriting historical post-images; the rationale is documented where readers will encounter it in §1.2 and repeated in §17, and it is consistent with 3d-2a §8.5's account of the earlier destroyed before-image. The new 177-entry manifest covers the current probe and P54–P75 artifacts.

The fourth binary digest in §1.1, `7fe2a6da4b27d6993a69567f759b8baa0e004a4d34fe2d1732d8fd9aeceaac8b`, matches the current retained build. I found no other fact made stale by the relink or the instrumentation.

## Verdict

**NOT READY** — correct the cross-launch “same event” sentence in §4, replace the claims of an observed platform “decision”/non-refusal with the measured request-and-no-movement claim in §§1.4, 5.3, 9.1 and 17, and change §17's historical refusal count from eighteen to 42. No application or save-path change is required.
