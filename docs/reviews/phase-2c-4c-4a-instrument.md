# Phase 2c-4c step 4a — instrument rebuild review

## Verdict: NOT READY

The six exercised plans are credible: each reaches its intended production surface, waits for the
surface-specific controls, invokes an external whole-file replacement after the R0-backed session is
open, receives a three-revision conflict, follows the intended reapply or negative arm, and finishes
with the named byte predicate. The four hooks also make no DOM or filesystem change when
`ECFG_PROBE_PLAN` is absent, although the instrumented application does retain the three extra IPC
commands and one startup IPC round trip. Those limits are accurately stated in the record.

The step is nevertheless not ready because the record makes a source-to-binary provenance claim its
own retained artifacts expressly cannot support, and because its account of recovery reach is false
and would leave step 4b with an incomplete instrumentation checklist. There are also two narrower
coverage contradictions.

## Findings

### High

1. **The proof set is attributed to the current source tree even though no artifact binds that source
   to the retained executable.** The record says P07–P12 "ran the binary the tree produces now" and
   later makes the step's narrow proof that "a tree rebuilt from the records reaches all six write
   surfaces" (`docs/decisions/2c-4c-4a-instrument-rebuild.md:186`,
   `docs/decisions/2c-4c-4a-instrument-rebuild.md:188`,
   `docs/decisions/2c-4c-4a-instrument-rebuild.md:400`,
   `docs/decisions/2c-4c-4a-instrument-rebuild.md:405`). The retained evidence establishes only that
   the proof bundles contain one executable digest and that it matches the executable currently at
   `target/debug/espansoconfig`; the record itself correctly says no retained artifact binds either
   executable to a source snapshot or build command
   (`docs/decisions/2c-4c-4a-instrument-rebuild.md:327`,
   `docs/decisions/2c-4c-4a-instrument-rebuild.md:336`). The same overreach is present in the opening
   claim that this step shows "the rebuilt whole runs"
   (`docs/decisions/2c-4c-4a-instrument-rebuild.md:3`,
   `docs/decisions/2c-4c-4a-instrument-rebuild.md:8`). Source inspection can establish that the plans
   are coherent, and the bundles establish which bytes ran; without a retained build transcript they
   cannot be conjoined into source provenance. Replace these claims with the artifact-level statement:
   P07–P12 ran the retained executable whose digest matches the executable currently standing at
   `target/debug/espansoconfig`, while source-to-binary provenance is unknown.

### Medium

2. **Section 6.7 says the instrument contains and reaches no recovery surface, but the proof plans
   already reach four of them and the driver silently omits them from its transcript.** The record
   says `RecoveryPanel.svelte` and `RecoveryWithoutCreation.svelte` have "no case, no plan function
   and no fixture" in this instrument (`docs/decisions/2c-4c-4a-instrument-rebuild.md:422`,
   `docs/decisions/2c-4c-4a-instrument-rebuild.md:427`). In production, however, the deleter, mover,
   duplicator and raw editor mount `RecoveryWithoutCreation` unconditionally and hand it their live
   conflict (`src/lib/components/MatchDeleter.svelte:539`,
   `src/lib/components/MatchDeleter.svelte:548`, `src/lib/components/MatchMover.svelte:802`,
   `src/lib/components/MatchMover.svelte:815`, `src/lib/components/MatchDuplicator.svelte:694`,
   `src/lib/components/MatchDuplicator.svelte:708`, `src/lib/components/RawEditor.svelte:531`,
   `src/lib/components/RawEditor.svelte:541`). The shared renderer then draws its marked recovery
   sentence whenever its model answers a reason
   (`src/lib/components/RecoveryWithoutCreation.svelte:88`,
   `src/lib/components/RecoveryWithoutCreation.svelte:94`); for these non-creating routes, any live
   conflict produces the surface's reason (`src/lib/browser/recovery.ts:2571`,
   `src/lib/browser/recovery.ts:2614`). P09–P12 therefore reach the new recovery markup as soon as
   their conflict exists; the current reporter misses it because it reads only the non-reapply status
   panel and later only `[role="status"]` blocks
   (`src/probe.ts:367`, `src/probe.ts:379`, `src/probe.ts:486`, `src/probe.ts:506`).

   The creating surfaces are also already wired to recovery: the editor and creator mount
   `RecoveryPanel` from their reapply outcome and retained conflict
   (`src/lib/components/MatchEditor.svelte:890`, `src/lib/components/MatchEditor.svelte:908`,
   `src/lib/components/MatchCreator.svelte:773`, `src/lib/components/MatchCreator.svelte:791`), and
   `manualResolution` is explicitly the unreconciled recovery entry arm
   (`src/lib/browser/reapply.ts:228`, `src/lib/browser/reapply.ts:239`). Existing unlaunched case arms
   already route collision/missing-anchor shapes through the editor and creator plans
   (`src/probe.ts:882`, `src/probe.ts:907`). What is absent is not all recovery reach: it is targeted
   reporting for the four marked sentences, an assertion and click for the editor/creator recovery
   offer, and plans that drive the opened recovery form through its own create/refusal/conflict/reload
   outcomes. Section 6.7 must say that precisely, and step 4b must add dedicated scopes because the
   recovery form has status panels of its own.

3. **The refusal coverage account contradicts both the proof summary and the enumerated raw launch.**
   Section 4 calls the proof set "five positives and one refusal"
   (`docs/decisions/2c-4c-4a-instrument-rebuild.md:208`), and its table records P12 as the raw
   negative-capability case with R1 retained and no backup
   (`docs/decisions/2c-4c-4a-instrument-rebuild.md:196`,
   `docs/decisions/2c-4c-4a-instrument-rebuild.md:203`). Section 6.2 then says "No refusal on any
   surface was launched here" (`docs/decisions/2c-4c-4a-instrument-rebuild.md:381`,
   `docs/decisions/2c-4c-4a-instrument-rebuild.md:385`). If the intended narrower claim is that no
   *post-reapply refusal arm* was launched, it must say so. As written, it is a false coverage claim.

### Low

4. **P01–P06 cannot be "the same six cases in the same six languages."** The proof table contains
   only `en` and `es`, with one language assigned to each surface
   (`docs/decisions/2c-4c-4a-instrument-rebuild.md:196`,
   `docs/decisions/2c-4c-4a-instrument-rebuild.md:203`), while the next sentence says the first pass
   used "the same six languages" (`docs/decisions/2c-4c-4a-instrument-rebuild.md:205`). This should be
   "the same six case/language pairings" or "the same six cases in the same two-language pattern."

### Observation

5. **The headline "all six write surfaces, both languages" is aggregate coverage, not per-surface
   bilingual coverage, but it is too easy to read as the latter.** Standing alone, the headline at
   `docs/decisions/2c-4c-4a-instrument-rebuild.md:208` is ambiguous. The immediately following mapping
   makes the actual scope exact: English was used only for editor, deleter and duplicator, while
   Spanish was used only for creator, mover and raw
   (`docs/decisions/2c-4c-4a-instrument-rebuild.md:209`,
   `docs/decisions/2c-4c-4a-instrument-rebuild.md:211`). I therefore do not read it as an unqualified
   claim that every surface was exercised in both languages, but it should be rewritten as "all six
   write surfaces, one language per surface, three launches in each language" so step 5 cannot inherit
   the broader reading.

## Instrument audit

The six plan/control paths line up with production markup and do not have the earlier silent-control
failure mode:

- The generic press helper waits for an exact translated label and throws if it never appears;
  `startProbe` turns that into `--- failed` (`src/probe.ts:217`, `src/probe.ts:229`,
  `src/probe.ts:962`, `src/probe.ts:979`). A disabled or inert send would likewise fail later while
  waiting for its conflict/reapply/final control, rather than produce the recorded positive tail.
- File and snippet selection are scoped to the sidebar and list rows
  (`src/probe.ts:267`, `src/probe.ts:299`), matching the production sidebar row and snippet-row
  buttons (`src/lib/components/Sidebar.svelte:37`, `src/lib/components/Sidebar.svelte:50`,
  `src/lib/components/SnippetList.svelte:105`, `src/lib/components/SnippetList.svelte:117`).
- Editor, creator, deleter, mover, duplicator and raw use the actual surface classes and controls
  (`src/probe.ts:555`, `src/probe.ts:583`, `src/probe.ts:637`, `src/probe.ts:692`,
  `src/probe.ts:706`, `src/probe.ts:733`, `src/probe.ts:749`, `src/probe.ts:784`,
  `src/probe.ts:797`, `src/probe.ts:831`, `src/probe.ts:843`, `src/probe.ts:863`). The production
  sections and sends are respectively present at `src/lib/components/MatchEditor.svelte:673`,
  `src/lib/components/MatchEditor.svelte:837`, `src/lib/components/MatchCreator.svelte:587`,
  `src/lib/components/MatchCreator.svelte:713`, `src/lib/components/MatchDeleter.svelte:429`,
  `src/lib/components/MatchDeleter.svelte:478`, `src/lib/components/MatchMover.svelte:630`,
  `src/lib/components/MatchMover.svelte:724`, `src/lib/components/MatchDuplicator.svelte:559`,
  `src/lib/components/MatchDuplicator.svelte:616`, `src/lib/components/RawEditor.svelte:448`, and
  `src/lib/components/RawEditor.svelte:515`.
- Creator option selection is correctly by localized visible text but assigns the model-minted option
  value (`src/probe.ts:649`, `src/probe.ts:663`); mover selection is correctly scoped to its own
  destination list (`src/probe.ts:755`, `src/probe.ts:766`). This matches the creator's `<select>`
  (`src/lib/components/MatchCreator.svelte:644`, `src/lib/components/MatchCreator.svelte:662`) and the
  mover's button list (`src/lib/components/MatchMover.svelte:683`).
- The deleter correctly waits for the already-open confirmation, then after successful reapply presses
  request and confirmation in sequence (`src/probe.ts:706`, `src/probe.ts:731`), matching the two
  distinct production states (`src/lib/components/MatchDeleter.svelte:474`,
  `src/lib/components/MatchDeleter.svelte:491`). The duplicator waits for the ordinary save-anyway
  acknowledgement after its second duplicate (`src/probe.ts:823`, `src/probe.ts:829`).

The conflicts are real for the six proof surfaces. Each plan opens or drafts against R0, then calls
the second writer before its send (`src/probe.ts:555`, `src/probe.ts:569`, `src/probe.ts:637`,
`src/probe.ts:678`, `src/probe.ts:706`, `src/probe.ts:718`, `src/probe.ts:749`,
`src/probe.ts:770`, `src/probe.ts:797`, `src/probe.ts:813`, `src/probe.ts:843`,
`src/probe.ts:856`). Rust runs a child `/bin/sh`, copies R1 to a temporary sibling, atomically renames
it over the target and waits for the child status (`src-tauri/src/probe.rs:84`,
`src-tauri/src/probe.rs:117`). The production editor sends its session's own base revision rather
than the current window projection (`src/lib/components/MatchEditor.svelte:509`,
`src/lib/components/MatchEditor.svelte:519`); the deleter documents and performs the same stale-base
rule (`src/lib/components/MatchDeleter.svelte:301`, `src/lib/components/MatchDeleter.svelte:317`), and
the other plans' retained transcripts show the same three-value relation. In every proof launch the
reported expected revision differs from found and found equals disk revision; the three values are
retained at `/private/tmp/espansoconfig-harness-2c-4c/launches/P07/probe.log:7`,
`/private/tmp/espansoconfig-harness-2c-4c/launches/P08/probe.log:7`,
`/private/tmp/espansoconfig-harness-2c-4c/launches/P09/probe.log:6`,
`/private/tmp/espansoconfig-harness-2c-4c/launches/P10/probe.log:7`,
`/private/tmp/espansoconfig-harness-2c-4c/launches/P11/probe.log:6`, and
`/private/tmp/espansoconfig-harness-2c-4c/launches/P12/probe.log:6`, with each triplet occupying that
line and the next two. The reporter alone would accept
one revision-shaped status block (`src/probe.ts:384`, `src/probe.ts:405`), but the retained
three-revision conjunction closes that weakness for these six launches.

The environment-off behavior is narrow and suitable for a temporary instrument. `probe_plan`
returns `None` for an absent or empty plan (`src-tauri/src/probe.rs:53`,
`src-tauri/src/probe.rs:67`); `startProbe` then returns before any plan or writer call
(`src/probe.ts:951`, `src/probe.ts:967`). The second writer itself requires both target and R1
variables (`src-tauri/src/probe.rs:99`, `src-tauri/src/probe.rs:103`). This does not mean the
instrumented build is production-identical: registration exposes three additional commands
(`src-tauri/src/probe.rs:133`, `src-tauri/src/probe.rs:151`) and the frontend always initiates the
plan lookup (`src/main.ts:20`, `src/main.ts:37`). The record states exactly those residual effects
(`docs/decisions/2c-4c-4a-instrument-rebuild.md:458`,
`docs/decisions/2c-4c-4a-instrument-rebuild.md:464`), so there is no unreported production-behavior
leak and no filesystem/UI mutation when the variables are unset.

Finally, the record otherwise handles the project's evidence distinctions correctly: it calls the
manifest a post-image that cannot prove a before state
(`docs/decisions/2c-4c-4a-instrument-rebuild.md:76`,
`docs/decisions/2c-4c-4a-instrument-rebuild.md:80`), separates contradicted byte identity for the two
known-digest fixtures from unknown identity for the rest
(`docs/decisions/2c-4c-4a-instrument-rebuild.md:25`,
`docs/decisions/2c-4c-4a-instrument-rebuild.md:30`), refuses to call the bundles freshly built
(`docs/decisions/2c-4c-4a-instrument-rebuild.md:178`,
`docs/decisions/2c-4c-4a-instrument-rebuild.md:182`), and labels all gate counts as with-harness rather
than production figures (`docs/decisions/2c-4c-4a-instrument-rebuild.md:432`,
`docs/decisions/2c-4c-4a-instrument-rebuild.md:444`). Those portions need no correction.

## Required fix before READY

Narrow the source/binary claims in the opening, section 4 and section 6.4; correct the refusal and
language coverage statements; and replace section 6.7 with the actual recovery boundary. Step 4b's
instrument work must include targeted reporting of `[data-recovery-without-creation]`, targeted
reporting and activation of the editor/creator recovery offer, and a `.recovery`-scoped driver for the
opened form and its own outcome panels. The existing four confirmed-reload holes remain correctly
listed separately at `docs/decisions/2c-4c-4a-instrument-rebuild.md:413` through
`docs/decisions/2c-4c-4a-instrument-rebuild.md:420`.

---

## Round 1 disposition — by the orchestrator, after the fix round

All five findings are closed. **No executable line changed**: every fix is in
`docs/decisions/2c-4c-4a-instrument-rebuild.md`, and `git status` after the round lists the same six
paths it listed before it. The instrument itself was not faulted by this review — the audit found the
six plans credible, the hooks inert without `ECFG_PROBE_PLAN`, and the conflicts genuine.

| # | Class | Finding | Disposition |
|---|---|---|---|
| 1 | High | Source-to-binary provenance claimed where no artifact binds a source snapshot to the retained executable | **Fixed in three passages, not four** — the opening, §4's proof-set sentence and §6.4's statement of the whole claim. Each is narrowed to *the retained executable whose digest matches the one now at `target/debug/espansoconfig`*, and each names what it used to say. §6.4 now states plainly that source-to-binary provenance is unknown, and why the two readings may not be conjoined |
| 2 | Medium | §6.7 said no recovery is in the instrument; four surfaces already reach the recovery markup | **Fixed by verifying the code, not by transcribing the finding.** `MatchDeleter.svelte:548` and `RawEditor.svelte:541` were read directly: the renderer is mounted **unconditionally** with the live conflict, so P09–P12 drew a recovery sentence. §6.7 now separates **reach** from **reporting**, and states step 4b's scope as the three concrete gaps: `[data-recovery-without-creation]` reporting, the editor/creator offer's assertion and activation, and a `.recovery`-scoped driver for the opened form |
| 3 | Medium | §6.2's "No refusal on any surface was launched here" contradicts §4's own negative case and its P12 row | **Fixed to the narrow claim it meant**: no *post-reapply refusal arm* was launched. The raw editor's negative-capability case was launched, and the record now says which distinction it is drawing |
| 4 | Low | "the same six languages" — there are two | **Fixed**: "the same six case/language pairings", with the count corrected in the same sentence |
| 5 | Observation | The headline "all six write surfaces, both languages" reads as per-surface bilingual coverage | **Fixed by stating the scope exactly**: one language per surface, three launches in each, aggregate and **not** per-surface, with the sentence that step 5 is what owes both languages on every surface |

**One thing this round adds that the review did not ask for.** The orchestrator's own fix for finding 1
wrote *"conjoined them in four places"* — a count larger than the three passages it had narrowed. It
was caught by the sweep that follows every fix round on this project and corrected before the commit.
That is the eighth consecutive round in this phase where a fix produced a finding, and the first where
the fix and the finding were the same person's.

**Sweep performed, and what it covered.** `tree produces`, `rebuilt whole`, `tree rebuilt from the
records`, `freshly built`, `six languages`, `No refusal`, `both languages`, `nothing about recovery`,
`binary the tree`, `this source tree`, `source tree runs`, `source provenance`. Every surviving hit is
a correction quoting the wording it retracts, which is the intended shape.
