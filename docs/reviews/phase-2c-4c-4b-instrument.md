# Review: Phase 2c-4c step 4b — recovery instrument

## Findings

### High — prose — retained artifacts do not support several construction-history claims

`docs/decisions/2c-4c-4b-instrument.md:23-25` and `:156` say that the two launched recovery fixtures matched on their **first launch**, and that the three expected-byte documents were authored for this step and had never previously been compared. Lines 369-371 also say that every gate ran after the last harness edit and before the launches, and that nothing in the repository changed afterwards except the record. Lines 16-19 similarly move from the current diff to the process claim “Everything this step wrote”. None of those chronology or first-attempt claims follows from a retained artifact.

The 4b manifest is explicitly a post-image (`docs/decisions/2c-4c-4b-instrument.md:329-331`), and there is no gate transcript (`:398`). P17 and P18 prove that the retained launches ended with `bytes=MATCH`; they cannot prove that no earlier attempt existed or that the fixtures had never been compared. Current `git status` and the hook diff prove the resulting tree shape, not every write made during construction or the ordering of unrecorded gate runs. This is the project’s named worst defect class: prose claims a stronger guarantee than its evidence can give, and no test can fail the extra claim.

Narrow these statements to what survives inspection: P17 and P18 are retained matching comparisons; the current tracked diff is exactly the four pre-existing hook lines; the gate table is the implementer’s unretained account and can only be re-established by rerunning it. Do not claim “first launch”, “never compared”, write history, or execution chronology without an artifact that records them.

### Low — prose/privacy — the record itself contains the owner-specific home-path prefix

`docs/decisions/2c-4c-4b-instrument.md:353` contains the literal `/Users/ccarpio/` while claiming that retained launch artifacts do not. The fixture and P13-P26 launch sweeps found no such path and no apparent real-config content, but the primary artifact is intended for a public repository and the review request expressly required checking the record too. Replace the literal with “the owner’s home directory” or `$HOME`.

No real configuration content was found in the 24 fixtures, P13-P26 `probe.log`, `probe.err`, `bytes.txt`, or `tree.diff` files. This finding is limited to the path disclosure in the record.

## Verified observations

### Observation — instrument — the recovery selectors satisfy the required scope

The opened-form driver does not escape `section.recovery`:

- `src/probe.ts:92` defines `RECOVERY_SURFACE` as `section.recovery`.
- `reportRecoveryForm()` at `src/probe.ts:686-717` finds the trigger with the descendant selector `section.recovery input.text`, then obtains destinations, transfer rows, replacement box, and create control from the recovery section.
- `reportRecoveryOutcome()` at `src/probe.ts:729-741` calls `outcomePanelOf(RECOVERY_SURFACE)`.
- `driveRecoveryForm()` at `src/probe.ts:1154-1189` scopes create, save-anyway, conflict, both reload controls, and the final status sweep to `RECOVERY_SURFACE`.
- `pressNamed()` at `src/probe.ts:278-290` searches only the supplied scope. The recovery plans pass `RECOVERY_SURFACE`.

The initial trigger lookup is performed from `document`, but its CSS selector requires the input to be a descendant of `section.recovery`; it is not an unscoped `input.text` lookup. The record also correctly limits its claim at §7.5: the older host reporters remain broader, but no recovery plan invokes them after a recovery outcome.

### Observation — instrument — non-creating recovery reporting is structurally keyed

`reportRecoveryWithoutCreation()` at `src/probe.ts:610-633` queries `[data-recovery-without-creation]` inside the named surface, counts the same marker document-wide, and reads the component-derived reason with `getAttribute`. Its localized paragraph comparison is emitted separately as `sentencesByDictionary`; it does not determine marker existence or the derived reason. Thus a host that re-inlined only the display sentence without the marker would produce `elements=0`, as required.

P13, P14, P15, and P16 independently show one marked element and one document-wide element. Their recorded reasons are `operationDraft` for deleter, mover, and duplicator, and `wholeDocumentDraft` for raw. P20-P22 repeat the three operation readings.

### Observation — instrument — recovery offer activation and form endings are present

`openRecoveryForm()` at `src/probe.ts:670-672` uses `pressNamed`, whose timeout throws and is reported by the top-level probe as failure. P17 records the creator offer, opens the form, reports one destination and six transfer rows, shows an editable trigger, and finishes at a committed outcome. P18 does the same through the editor, records the repeated-trigger refusal, presses save-anyway, and matches `editor-recovery-refused-expected.yml`. P19 records the third writer, the recovery form’s own three-revision conflict, the first reload choice, the distinct “Discard my text and load it” confirmation, and no recovery status block afterwards.

The three expected fixtures are exactly their named R1 documents plus one final two-field item. `creator-recovery-create-expected.yml` appends `:probe` / `probe creation`; `editor-recovery-refused-expected.yml` appends `:beta` / `probe edit`; the unlaunched `editor-recovery-create-expected.yml` appends `:probe` / `probe edit`. `RECOVERY_POSITION` is the sole frozen `{ End: {} }` value at `src/lib/browser/recovery.ts:803`, and `RecoveryPanel.svelte:580-582` contains no placement control. Its trigger input is editable at `RecoveryPanel.svelte:584-596`; the driver types the literal `:probe` and contains no suffixing logic.

### Observation — instrument — the third writer is harness-confined and inert when its variable is absent

`src-tauri/src/probe.rs:120-122` delegates `probe_third_writer` to `replace_the_target("third", R2_VARIABLE)`. `replace_the_target()` reads the target and source environment variables before spawning `/bin/sh` (`:141-152`); an unset `ECFG_PROBE_R2` therefore returns `Err` before any child process or write. The command is registered only through the untracked probe module (`:174-194`) reached by the two pre-existing hook lines. The launch table supplies a non-empty R2 only for `editor-recovery-conflict`; no other plan invokes the command.

### Observation — prose/code argument — hole 1 is accurately left open

The record does not present hole 1 as a measurement. The code supports its narrower reachability argument:

- `repairSelection()` has one non-test caller, `select()` at `src/lib/browser/workspace.svelte.ts:2015`.
- `select()` obtains the held projection, locates the clicked match in it, and creates `next` from that projection at `workspace.svelte.ts:1975-1983` before calling `getMatch(next.id)` at `:2000`.
- `identityRecovery()` maps stale revision to `reresolve`, while only `identityNoSuchMatch`, `identityWrongDocument`, and `unknownDocument` map to `clearSelection` (`src/lib/ipc/errors.ts:741-748`).
- Core resolution checks document, then revision, then node in that order (`crates/espansoconfig-core/src/model/document.rs:285-301`). Disk bytes differing from the held projection therefore produce stale revision rather than no-such-match.

This supports “not reachable by this DOM-driven instrument” under the current caller chain. It does not prove general unreachability, and §5 correctly says that no launch attempted or measured the second producer.

### Observation — evidence — launch ledger and geometry claims re-derive cleanly

For each retained launch P13-P26, direct inspection found exactly one `--- end`, no `--- failed`, a zero-byte `probe.err`, and `bytes=MATCH`. All fourteen `bytes.txt` files carry binary digest `fcc9c3ac8713906d9793552a714e744218f720ea9714b6a1e700e99e05effc2e`, which currently matches `target/debug/espansoconfig`. The language count is seven English and seven Spanish; all fourteen logs say `1180x728 dpr=2 hasFocus=false visibility=hidden` and have matching `lang` and `picked` values. The 55-entry 4b manifest verifies completely; the 48-entry 4a manifest fails only for `launch.sh`, `src/probe.ts`, and `src-tauri/src/probe.rs`.

The zero-height observation is exact for every log that measured `section.recovery`: P17, P18, P19, P25, and P26 each record `491x0`. P17-P19 also record normally sized offer controls and full form/status descendants. P13/P20 and P15/P22 place the marked paragraph at `y=-14`, and P14/P21 at `y=-15`; P16’s raw paragraph is at `y=121`. The record appropriately carries these as measurements for step 5 rather than judging visibility here.

### Observation — production boundary — the resulting tracked production diff is unchanged from 4a

The current `git diff -- src/main.ts src-tauri/src/main.rs` is exactly the four hooks quoted by `docs/decisions/2c-4c-4a-instrument-rebuild.md` §2.1: `mod probe;`, replacement of the builder call with `probe::register_with_probe(...)`, the `startProbe` import, and `startProbe();`. The stat is 5 insertions and 1 deletion. `git status --short --untracked-files=all` lists only those two modified hook files, the two untracked probe sources, the 4b record, and this review. No production delta beyond the pre-existing hooks is present in the resulting tree.

## Verdict

**NOT READY** for committing this step. The instrument itself covers the declared recovery reporting, scoped form driving, expected-byte cases, third writer, and four confirmed-reload holes; the retained launches and geometry claims check out, and the resulting production diff remains limited to the pre-existing hooks. The blocking issue is the High prose defect: the primary record repeatedly upgrades post-image evidence into unretained first-attempt, authorship, and chronology guarantees. Narrow those claims to the artifacts that actually exist, and remove the owner-specific path prefix identified by the Low finding, before committing.

---

## Orchestrator disposition — both findings closed before the commit

Written by the orchestrator after applying the fixes. The review above is Codex's, unedited.

**The High is closed in four passages, and the fix round found a fifth.** Every narrowed claim now
states what a retained artifact shows and names what it cannot:

| Passage | Was | Is |
|---|---|---|
| §"No production source file changed" | *"Everything this step wrote is in …"* — a write-history claim | a **resulting tree shape** claim, with the untracked paths listed as such |
| §"Fourteen launches" | *"never compared against anything before … matched on the first launch"* | **retained matching comparisons**, with the post-image (§7.2) named as the reason an earlier attempt would not show |
| §3.4's table footer | *"matched byte-for-byte on their first launch"* | **retained matching comparisons**, explicitly about the launches `launches/` holds |
| §9's gate table | *"every row ran after the last harness edit and before the launches; nothing has changed since"* | **the implementer's account and not an artifact**, with no ordering claimed and re-running named as the only way to establish one |
| §6.3 *(found by the post-fix sweep, not by the review)* | *"predictions never compared against anything"* | *"predictions **no retained launch** compares against anything"* |

**A sixth instance was introduced by this fix round and removed within it.** The first draft of the
§"Fourteen launches" narrowing asserted *"no launch was discarded from `launches/`"* — which is the
same defect one level down, since a post-image cannot witness a discard. It was cut rather than
softened. This is the **ninth consecutive round in this phase where a fix produced a finding**, and
the second where the fix and the finding were the orchestrator's own.

**The Low is closed in the record and deliberately left standing in this review.** The record now
says `$HOME`. This file keeps the literal because the finding has to name the string it is about,
and because that matches 44 existing `docs/reviews/` files — Codex output is kept verbatim by
standing convention. The distinction is that a **decision record** is authored by this project and a
**review** is a transcript of what an outside reviewer said.

**Neither finding was a defect in behaviour, in the instrument or in the application**, and the
review says so explicitly: the recovery selectors satisfy the required scope, the reporting is
structurally keyed to the element rather than to any display string, the third writer is
harness-confined and inert without `ECFG_PROBE_R2`, and hole 1 is accurately left open. **No
executable line changed in this fix round.**
