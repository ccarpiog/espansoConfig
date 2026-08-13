# Phase 2c-4c step 5b — the record rewrite: Codex review round 2

# NOT READY

## Findings

### High — `docs/decisions/2c-4c-5-window-reading.md:47-50, 427-428, 744-750, 831-847, 1129-1141, 1221-1226` — M2's High turns a one-point paint result into pointer unreachability

The raise is not supported by the retained measurement as the record has bounded it. The sound result
is that the host outcome sibling occupied the recovery children's band and
`document.elementFromPoint` at the close button's **centre** returned that sibling in all eight
pre-fix launches. The same rectangles also show that the sibling began seven pixels below the
section's top while the close button began at the section's top and was 27 pixels high. Thus even the
one tested control was not measured as wholly covered: its top seven-pixel strip lies outside the
sibling's rectangle. No point in that strip was tested.

More importantly, §8.16 correctly says that `elementFromPoint` establishes paint order at the sampled
point, not event delivery, and expressly says it does **not** establish that a person's press would
land there. §8.17 correctly says that six of seven controls were outside the viewport and untested.
M2 then crosses both bounds: it says a pointer press at the tested point *would* have landed on the
panel, calls the control unreachable by pointer, and generalises the result to the whole central
deliverable and every screen that can reach it. That is exactly the guarantee the two bounds withhold.
`HTMLElement.click()` does disqualify the old claim that all affected controls stayed operable, but
disproving that ground does not prove its opposite.

The geometry defect remains confirmed: the zero-height section placed an opaque host panel through
the form's band, and 5b-2 removed that overlap. On the evidence retained, **Medium was the supported
severity**. A High based on pointer unreachability needs a trusted pointer path (and coverage adequate
to support the scope claimed), or the record must supply and consistently argue a different High
criterion based only on the measured visual occlusion. Otherwise restore M2 to Medium and update the
preamble's M2-over-M1 ranking, §6's roster, and §11's verdict.

### High — `docs/decisions/2c-4c-5-window-reading.md:153-156, 1180-1198, 1204-1208` — the gate rewrite still promotes an account into construction chronology

Section 10 first states the correct limit: no gate transcript witnesses that the figures were
produced, when they were produced, or what tree was tested, and the numbers are a worker's account
rather than evidence. It then says the orchestrator re-ran the gates **before the rewrite was
applied**, that `PROGRESS.md` retains the run, and that this establishes the figures on that tree at
that moment. `PROGRESS.md` is another prose account, not command output or a tree identity. Indeed its
own handoff says the figures may be claimed as produced but not as produced after the last edit
(`PROGRESS.md:7567-7572`). The later assertion that 5b-2 searched the bundle *after* its CSS change
has the same unsupported ordering. The manifest paragraph likewise says “Re-run at 5b-3” where the
retained fact is only the current 54/1 verification result.

This is the narrower surviving instance of round 1's construction-chronology High, and it directly
contradicts §8.13. Close it by stating the current manifest comparison as a current result, treating
the gate and bundle-search figures consistently as unretained accounts, and deleting the claims about
their position relative to the rewrite/CSS edit and the tree “at that moment.” A retained transcript
coupled to a tree identity would also close it.

## Verified observations

- Round 1's M2 premise is fully corrected. The cited model transitions show that
  `manualResolution` retains the conflict-bearing session, both creating hosts render the host outcome
  immediately after `RecoveryPanel`, and P54–P61 measured the sibling in the open-form state.
- The source and measurement citations checked in the rewritten record still land on what they name,
  including the four `RecoveryWithoutCreation` mount sites, `reveal.ts:57-82, 96-99`, the editor and
  creator host markup, `attemptOfReapply`, the recovery CSS, the M1 control keys, and selection hole 1.
- Outside the gate passages identified above, the rewrite narrows round 1's construction and
  write-history claims to retained comparisons and final state. It also keeps the reveal request and
  sampled scroll position separate.
- O6's downgrade is well argued. The Spanish imperative/infinitive difference follows the stated
  prose-versus-control register rule; comparison is possible from displayed text without a promised
  compare control; and the remaining English wording difference supports a consistency observation,
  not a demonstrated control-label defect. Observation neither over- nor under-claims the evidence.
- The creator-panel bimodality is reported without attributing it to the fix, and §§8.16–8.18 state
  the one-point hit-test and unexplained-height limits accurately. The problem is M2 crossing those
  limits, not the bounds themselves.

## Verdict

**NOT READY.** The rewrite closes round 1's false M2 premise, intermediate-write claims, reveal
causation, and L3 classification, and its source citations have not drifted. But the new High claims
pointer unreachability that the retained centre-point paint test and the record's own bounds do not
establish; Medium is the supported classification unless stronger evidence or a different, consistently
bounded High rationale is supplied. Section 10 also leaves a narrower construction-chronology claim
standing by treating `PROGRESS.md`'s unretained gate account as proof of execution order and tree
state. The M2 severity change consequently cannot support the current preamble ranking, findings
roster, or final verdict yet.
