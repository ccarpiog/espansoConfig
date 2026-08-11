# Confirmation review of Phase 2c-4b step 3d-2a — rebuilt window-reading instrument, round 2

This pass checked the amended record against `src/probe.ts`, `launch.sh`, all 21 fixtures, all eleven
launch directories, the complete P07–P11 `probe.log`, `probe.err`, and `bytes.txt` artifacts, the
selection/adoption and match-editor branches the new plans depend on, and
`2c-4b-3d-1-notes.md` §7. It also re-derived the case and expected-file counts and verified the
46-entry manifest. No URL or external source was used.

## Findings

### Medium — the fix-round summary turns a final-byte observation into an unproved no-write claim

Section 8.4 says, **“All five expect R1's own bytes, and every one matched: nothing was written by
any of them”** (`docs/decisions/2c-4b-3d-2a-instrument-rebuild.md:656-657`). The text before the colon
is observed; the conclusion after it is not. The five `bytes.txt` files establish final equality to
R1 and absence under the harness's two-part backup search. There is still no invoke spy or command
counter, so an identical-byte write or a transient write undone before inspection is invisible.

The record states that exact limitation at §6.1: **“there is still no invoke spy and no command
counter”** and a write producing identical bytes or a transient write would leave the same artifacts
(`2c-4b-3d-2a-instrument-rebuild.md:361-364`). `launch.sh` repeats the bound at lines 63-67. The new
sentence is therefore both stronger than the artifacts and internally contradictory. It should say
only that all five ended at R1's bytes and that the backup search found nothing.

### Low — the historical no-change correction is only partial; narrower categorical instances remain

The rewrite now correctly says there is no before-image and that `src/probe.ts` was edited, but it
still says **“No production source file differs from `HEAD`”**
(`2c-4b-3d-2a-instrument-rebuild.md:71`) immediately before identifying modified
`src/main.ts` and `src-tauri/src/main.rs` at lines 72-76. Those are production source paths and their
probe hook lines do differ from `HEAD`.

It also says **“§8.1 lists every line this round changed”** (`:343`) and **“Nothing under `src/lib/`,
`src/lib/components/`, `crates/` or `src-tauri/src/` other than the untracked `probe.rs`, which was
not touched either”** (`:525-527`). There is no pre-fix working-tree image from which either
exhaustive historical assertion can be verified; §1 itself correctly says no artifact can establish
what the step did not alter along the way (`:78-85`). The current diff supports a present-state
statement, not those historical ones. This is a narrower surviving instance of original Low 2.

### Low — the binary measurement is sound, but its causal gloss still outruns the retained evidence

Section 5.10 correctly measures two binary groups, but then says, **“The two differ because the fix
round edited `src/probe.ts` and rebuilt”** (`2c-4b-3d-2a-instrument-rebuild.md:330-332`). The retained
artifacts prove that P01–P06 ran digest `3f1b3506…`, P07–P11 ran `21359e1a…`, and the latter currently
equals `target/debug/espansoconfig`. They do not bind either executable to a source snapshot or build
command. The very next sentence correctly says **“nothing else about either binary is established
here”** and that the evidence says nothing about when or from what tree it was built (`:332-334`).
Delete the causal clause or label it as the operator's unretained account. Original Low 3 is therefore
only partially closed: the unsupported “freshly built” wording is gone, but an unsupported
source/build attribution remains.

### Low — §6.7 calls disclosed coverage gaps “holes” while its own entries say otherwise

The paragraph introducing §6.7's cautions says, **“Four things this table does not say, each of which
is a hole rather than a coverage gap”** (`2c-4b-3d-2a-instrument-rebuild.md:458`). Caution 3 says
`editor-fallback` exists and **“(e) is unlaunched”** (`:470-475`), and caution 4 says the `:twice`
mechanism exists but has **“no observation”** (`:476-477`). Those are coverage gaps under the
record's own definitions, not missing instrument paths. Caution 1 really is a hole (no case for the
second `gone` producer); caution 2 contains both a scoped justification for editor-only
ineligibility and absent cross-surface reload coverage. The facts are disclosed, so the schedule is
not stranded, but the exhaustive classification is false and should distinguish missing cases from
existing-but-unlaunched paths.

## Confirmation of the seven original findings

| Original finding | Status | Confirmation |
|---|---|---|
| High 1 — no case could draw `browser.notice.gone` | **closed** | `editor-reload-gone` exists in both the `launch.sh` table (`launch.sh:99`) and `runPlan` (`src/probe.ts:1081-1082`). `editorReloadPlan` selects `:gamma` at R0 position 2, installs the two-item `target-deleted-r1.yml`, and presses the two distinct reload controls (`src/probe.ts:765-788`). P09/P10 draw `browser.notice.gone` in English and Spanish (`launches/P09/probe.log:24-31`; `P10/probe.log:24-31`). |
| High 2 — no fixture made a drafted editor field newly ineligible | **closed** | The two new fixtures differ only at `:beta`'s replacement line, `replace:` versus `replace: ""` (`fixtures/target-empty-replace-r1.yml:6`; `target-empty-quoted-r1.yml:6`), and are 206 versus 209 bytes. Both plans draft `""` (`src/probe.ts:1077-1080`; P07/P08 logs line 5). P07 refuses with `fieldCollisions`; P08 returns `alreadySatisfied`. The source trace below establishes `ownsNoBytes`, not a value collision. P11 supplies the Spanish refusal. |
| High 3 — bounds omitted downstream §7 obligations and absent cases | **closed** | §6.7 enumerates every component obligation in `2c-4b-3d-1-notes.md:475-482`, plus the separately owed `gone` notice, and names both the available case and launch state. It explicitly discloses the unprovoked `repairSelection.clearSelection` producer (`instrument-rebuild.md:460-466`), the unlaunched L43–L46 `differentMatch` pairing (`:470-475`), and the unobserved second press (`:476-477`). The “holes” label is inaccurate as reported above, but the underlying scheduling facts are present. |
| Medium — opening generalized two old/new digest comparisons to every fixture | **closed** | The opening now limits contradicted byte identity to `base-r0.yml` and `elsewhere-r1.yml`, and says it is unknown for the other seventeen rebuilt fixtures (`instrument-rebuild.md:30-35`). §4.2 retains the same scope (`:250-275`). |
| Low 1 — exhaustive fixture provenance omitted 3c-2 §1.3 | **closed** | The opening names all three records (`instrument-rebuild.md:23-28`), and the file table assigns `reordered-beta-first-r1.yml` and `mover-end-expected.yml` to 3c-2 §1.3 (`:100-102`). It separately identifies the two fix-round fixtures as authored from code rather than re-authored from a record. |
| Low 2 — historical no-change claims lacked a before-image | **partially closed** | §1 now states the evidentiary limit (`instrument-rebuild.md:78-85`), but the contradictory/currently false and unrepeatable categorical claims at lines 71, 343, and 525-527 remain, as detailed above. |
| Low 3 — “freshly built” was not bound by retained build evidence | **partially closed** | The launch description now accurately says it copies whatever `ECFG_BINARY` names and disclaims freshness (`instrument-rebuild.md:160-172`). The two binary digests are independently reproducible, but §5.10 still attributes their difference to a particular edit and rebuild without a retained source/build binding (`:330-334`). |

## The two new proof constructions

### P07/P08 isolate eligibility, and P07 reaches `ownsNoBytes`

The fixture diff is exactly one line and three inserted bytes: `replace:` becomes `replace: ""`.
Both parse as a present replacement with decoded value `""`; the first has a zero-width scalar span,
while the quoted scalar owns its two quote bytes. `fieldEligibility` returns `ownsNoBytes` exactly
when `span.start === span.end` (`src/lib/browser/matchEditor.ts:785-805`).

The same `editorPlan(false, '')` runs in both cases (`src/probe.ts:1077-1080`) and each raw log records
`editor drafted="" length=0` (P07/P08 `probe.log:5`). P07's disk field therefore has the drafted value
but is ineligible; P08's has the drafted value and is editable. `sameBaselineState` compares presence,
value, and eligibility (`matchEditor.ts:1807-1812`), and `fieldReapply`'s final test requires present,
editable, and value-equal for `satisfied` (`:1848-1866`). P07 prints `manualResolution` /
`fieldCollisions` naming Replacement text (`P07/probe.log:27`), while P08 prints
`alreadySatisfied` (`P08/probe.log:28`). The pair therefore behaviorally isolates eligibility from
value collision. As the record properly concedes at `instrument-rebuild.md:576-582`, the transcript
does not print the internal refusal code; `ownsNoBytes` is established by the fixture-plus-source
trace.

### P09/P10 use the length producer, not `repairSelection.clearSelection`

P09/P10 select `:gamma` (`probe.log:5`) at position 2 of three-item R0 and install the two-item
`target-deleted-r1.yml` (`:7`). `editorReloadPlan` then presses `reloadDiskVersion` and
`confirmReload` (`src/probe.ts:779-788`). `BrowserState.adoptDiskVersion` synchronously calls
`installView` and `repairAfter` (`src/lib/browser/workspace.svelte.ts:1829-1836`);
`repairAfter` calls `reresolve` (`:3118-3134`); and `reresolve` returns `gone` when the held position
has no candidate (`src/lib/browser/selection.ts:192-196`). No command failure enters
`repairSelection`, so its `clearSelection` arm at `selection.ts:280-292` cannot be this producer.
The record claims the correct producer at `instrument-rebuild.md:637-639`.

## Counts, launch integrity, and manifest

- `launch.sh` has 23 case rows and `runPlan` has 23 switch arms. The eleven directories contain nine
  distinct launched cases: `editor-exact`, `mover-changed`, `creator-front`, `raw-negative`,
  `deleter-exact`, `duplicator-exact`, `editor-ineligible`, `editor-empty-satisfied`, and
  `editor-reload-gone`. The other 14 names are exactly the list in §6.2
  (`instrument-rebuild.md:378-386`).
- There are nine `*-expected.yml` files. P01, P03, P05, and P06 compare four distinct expected files;
  P07–P11 all compare R1. The five uncompared names in §6.3 are therefore exact
  (`instrument-rebuild.md:397-410`).
- Every P01–P11 log ends at `--- end`, none contains `--- failed`, and every `probe.err` is zero bytes.
  The P07–P11 byte and backup statements agree with their retained `bytes.txt` files.
- `manifest-3d-2a-post.sha256` has 46 entries, and `shasum -a 256 -c` succeeds for all 46. Its declared
  scope is complete: `launch.sh`, all 21 fixtures, all eleven `probe.log`, all eleven `bytes.txt`, and
  both probe sources. It covers both new fixtures, amended `launch.sh`, amended `src/probe.ts`, and
  P07–P11's logs and byte reports. As the record says, it does not purport to cover bundles,
  `probe.err`, launch-tree copies, or the decision record itself.
- The two retained executable groups reproduce §5.10's measured digests: P01–P06 are mutually
  identical at `3f1b3506…`; P07–P11 are mutually identical at `21359e1a…`; the latter equals the
  current `target/debug/espansoconfig`. `sh -n launch.sh` and `npm run check` also pass; the latter
  reports 419 files, 0 errors, and 0 warnings.

## Verdict

**NOT READY** for step 3d-2b to proceed on this record. The two formerly missing instrument paths now
exist and their five launches prove the intended behavioral distinctions, and §6.7 contains the
facts needed to schedule the reading. The handoff record nevertheless still contains unsupported
historical/source-provenance assertions and a new categorical no-write claim that directly exceeds
its own stated evidence boundary. Correct those sentences and the “holes” classification; no new
launch or fixture is required by this review.
