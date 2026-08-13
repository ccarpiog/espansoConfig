# Phase 2c-4c step 5b — the record rewrite: Codex review round 3

# NOT READY

## Findings

### Medium — `docs/decisions/2c-4c-5-window-reading.md:59-62, 756-762, 881-954, 1262-1264` — The new preamble undercounts the finding roster

The restored-severity sentence says **"The two findings are both Mediums"**, but the record's formal
roster is two Mediums, two Lows and six Observations, and §6 contains L1 and L2 as findings in addition
to M1 and M2. Section 11 states the full arithmetic correctly. The surrounding ranking discussion
clearly intends to compare only M1 and M2, but the new unqualified count says that the document has
only two findings and thereby drops both Lows in the preamble. This is the narrower instance created
by the round-3 fix. Close it by naming the intended subset, for example **"The two Medium findings,
M1 and M2, rank neither above the other"**, without changing the roster or either severity.

## Verified observations

- Round 2's first High is otherwise closed. M2 is Medium in the document preamble, the §6 preamble,
  its entry and §11; no live classification ranks it above M1 or calls it High. References to the
  withdrawn High are historical and explicitly reject its pointer-unreachability ground.
- M2 does not under-claim the retained result. Its entry still calls the defect confirmed, real,
  measured in all eight pre-fix launches in both languages, visually occluding the form's band, fixed
  at 5b-2, and not a disk defect. It separately records the false latent premise, the withdrawn
  programmatic-operability ground, the over-claimed High, and the trusted pointer path and wider
  coverage that a pointer-based High would require.
- The retained geometry supports the new 7-pixel qualification: the 5b-1 record places the sibling
  seven pixels below the section top and gives the close control a 27-pixel-high rectangle beginning
  at the section top. It also records `somethingElse` only at the control centre and six other controls
  as `outsideViewport`. The current record therefore stays within §§8.16–8.17.
- Round 2's second High is closed. §1.3 presents 54 OK / one FAILED as a current comparison; a direct
  check of the retained 4b manifest against the present scratch tree produced that same count. §10
  treats all four gate reports as accounts, denies that any transcript or tree identity is retained,
  and names a retained transcript coupled to a tree identity as the missing evidence. Its bundle-search
  paragraph expressly withholds the ordering relative to the CSS edit.
- The new §8.13 and §10 descriptions of round 2 do not create construction chronology. Round 2's
  retained review itself identifies the gate/rewrite ordering, the CSS/search ordering and the use of
  `PROGRESS.md` as the narrower instance; saying that round 2 named or caught those claims is a
  comparison with that retained review, not an inference about command or edit order.
- The new source and measurement references checked still land on what they name: the recovery CSS
  at `RecoveryPanel.svelte:804-818`, `reveal.ts:57-82, 96-99`, `reapply.ts:540-547`, the editor outcome
  transitions at `matchEditor.ts:1078-1079, 1522, 1525-1530`, and the P54–P61 geometry/count tables in
  the 5b-1 record. No cited rectangle, count or source location checked here has drifted.
- The leading correction note's three-High/one-Medium/one-Low count for round 1 and two-High count for
  round 2 agree with those retained reviews. The only arithmetic mismatch is the unqualified current
  roster count in the document preamble identified above.

## Verdict

**NOT READY.** Both Highs from round 2 are substantively closed: Medium is the supported and
consistently applied M2 severity, and the gate and bundle-search prose no longer turns accounts into
execution order or a tree guarantee. One narrower record defect remains in the fix itself: the new
preamble says there are two findings even though the consistently stated roster is two Mediums, two
Lows and six Observations. Qualifying that sentence as a comparison of the two Medium findings closes
the round without changing any substantive judgement.
