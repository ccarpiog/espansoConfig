# Phase 2c-4b — reapply design consult

## VERDICT

2c-4b is the deliberately narrow operation promised by *Keep my draft*: adopt the revision-bound disk snapshot already captured by 2c-4a, establish a conservative correspondence in that snapshot, rebuild the pending edit or operation against the new projection, withdraw old consent, and submit through the existing command and the one save transaction. It is not recovery in general. Raw whole-document text cannot be reapplied honestly, an ambiguous or missing match is a refusal, and no partial field save, fuzzy positional guess, YAML reconstruction, three-way merge, or save-as-new fallback belongs here. The outer protocol is shared, but correspondence has two confidence policies: the match editor may fall back from exact item identity to a unique unchanged trigger and then performs per-field collision checks; delete, move, duplicate, and every positional anchor require exact item correspondence. Creator is targetless and is revalidated against the new destination. This should be three steps: core correspondence and wire evidence; browser reapplication as values; then the single choice producer, components, i18n, and deterministic window readings.

## Q1 — Scope

**Ruling: 2c-4b adds one honest path from a retained conflict to a new ordinary save attempt; it does not add a general merge or recovery system.**

2c-4a already did the preservation half. A conflict carries the whole disk text, projection, and revision as one content-hash-paired observation (`src/lib/ipc/types.ts:1647-1675`); the six frontend conflict arms install nothing, and `adoptDiskVersion` is the only installing transition (`docs/decisions/2c-4a-2-notes.md:26-38`). 2c-4b begins only after that state exists. Its successful path is:

1. authorize adoption of that conflict's disk snapshot, subject to the same origin and projection-generation guards as reload;
2. establish the target or anchor correspondence ruled in Q2;
3. build a fresh session over the adopted `DocumentView`, retaining the person's authored value or operation choice but using `disk_revision` as the new base;
4. discard every acknowledgement collected for the old candidate;
5. invoke the existing `save_match`, `create_match`, `delete_match`, `move_match`, or `duplicate_match` command normally. All six writers already converge on `run_one_save` and `save_document` (`src-tauri/src/commands.rs:19-39`).

That delivers reapply for five surfaces: match editor, creator, deleter, mover, and duplicator. It does **not** deliver it for raw text, for the reason in Q4. It does not deliver save-draft-as-new, a match picker, per-field manual choices, or recovery when correspondence is missing or ambiguous; those are 2c-4c. The plan says both that neither side is overwritten and that an unidentifiable target requires manual resolution (`IMPLEMENTATION_PLAN.md:534-542`), while the split names rebase as the dangerous algorithmic half and deliberately puts the fallback later (`docs/decisions/2c-split-notes.md:145-169`).

There is one outer protocol and two confidence policies, not six unrelated implementations. `ConflictDraftKind` remains useful but is not by itself the complete discriminator: it says whether the retained value is authored text or an operation choice (`src/lib/browser/draftKind.ts:42-52`), which already prevents a dishonest copy for the latter (`CLAUDE.md:231-237`). Within `authoredText`, raw is impossible, creator has no existing target, and only the match editor has a target plus field intents. Within `operationChoice`, target correspondence is strict and a mover may also have an anchor. Put those distinctions in browser-model values, never in five renderers.

## Q2 — Identification

**Ruling: identify within the original sequence by exact evidence first; allow a unique trigger fallback only for the match editor; never use the item index as a tie-break.**

`MatchId` cannot cross the boundary: its node is a parser-arena position and its revision is present precisely so a reparse refuses it (`crates/espansoconfig-core/src/model/match_view.rs:67-92`). `DocumentPath` cannot become the replacement identity either: `matches[3]` is an address inside one parse and shifts after insertion, deletion, or reorder (`crates/espansoconfig-core/src/patch/path.rs:19-25`; `src/lib/ipc/types.ts:83-94`).

At the time the surface opens, freeze a core-produced `ReapplyAnchor` beside the session. It must contain the document and base revision; the containing sequence address (document index plus every path segment except the final item index); a digest of `MatchView.source_text`; a digest of the item's exact owned physical-line runs; and an exact trigger-form fingerprint. The trigger fingerprint is the presence and source spelling of `trigger`, `triggers`, and `regex`, in source order—not a resolved YAML type and not merely the displayed primary trigger. The old item index may be retained for diagnostics only. `MatchView.source_text` is the complete mapping slice but deliberately excludes trivia above it (`crates/espansoconfig-core/src/model/match_view.rs:369-401`); the owned-run digest is separately necessary for operation choices because delete, move, and true duplicate act on the ownership envelope, including item-owned comments (`crates/espansoconfig-core/src/patch/edit.rs:786-821`; `:823-847`).

Resolve against the exact `ConflictResult.disk` snapshot, in this order:

1. Refuse unless document identity, parsed state, and the original sequence address exist. A sequence address includes the document because a `DocumentPath` alone does not (`src/lib/browser/matchMove.ts:350-397`). Candidates are only matches in that sequence.
2. Compare the owned-run digest. Exactly one match is an exact operation correspondence. More than one is `ambiguousExact`; none continues.
3. Compare the complete mapping-slice digest. Exactly one match is an exact match correspondence. More than one is `ambiguousExact`; none continues. This tier lets the editor survive a change only to ownership trivia, but it is not sufficient for delete, move, duplicate, or an `after` anchor.
4. **Match editor only:** compare the exact trigger-form fingerprint. Require that fingerprint to have been unique in the base sequence **and** to be unique in the disk sequence; exactly one candidate is then a provisional correspondence and proceeds to Q4's field checks. Zero is `targetMissingOrTriggerChanged`; non-uniqueness on either side is `ambiguousTrigger`. Do not rank duplicate-trigger candidates by similarity. This is the policy definition of sufficient confidence, not a claim of metaphysical identity: an external delete followed by creation of an indistinguishable unique replacement cannot be detected. The weaker tier is restricted to non-destructive field intent for that reason.
5. For every other use, no exact owned-run match is a refusal. Position, nearest path, common fields, search text, label, content similarity, and parser node number are not fallback evidence.

The tie rule is therefore “unique at the permitted strongest tier, or refuse.” Once a tier has multiple candidates, a lower-quality signal may not break the tie. In particular, the former final `Index` path step and ordinal never decide identity. The repository already states the consequence of doing that for deletion: deleting an earlier item would re-point the path at another snippet (`src-tauri/src/commands.rs:1634-1645`).

The named failures resolve as follows:

- **Deleted externally:** no exact item and no old trigger; refuse.
- **Trigger edited externally:** the exact item changed and the old trigger is absent; refuse, even if the item stayed at the same index.
- **Two matches now share the trigger:** an unchanged item may still win by a unique exact digest. If exact evidence does not distinguish it, the trigger tier has two candidates and refuses.
- **Sequence reordered:** the final path index is ignored. Exact item evidence still identifies the target in its original sequence; a match-editor trigger fallback also may. A move's placement is then rebuilt as ruled in Q4.
- **Whole file rewritten:** formatting outside the item's owned runs does not matter. An exact item can survive. If the rewrite changes the item bytes, operation choices refuse; the match editor proceeds only if its exact trigger fingerprint remains unique and its changed drafted fields pass the field collision rule. A wholesale formatter that respells every trigger therefore produces an honest refusal.

This is intentionally pessimistic. “Probably the same row” is not sufficient confidence for an action that can delete or copy another snippet.

## Q3 — Where the algorithm lives

**Ruling: split it: correspondence and ownership evidence live in the Rust core; per-surface intent rebasing lives in browser models; renderers only dispatch model choices. Add no writing entry point and no force-shaped command.**

Add a pure root module, `crates/espansoconfig-core/src/reconcile.rs`, for `ReapplyAnchor`, `ReapplyMode`, `ReapplyResolution`, and the unique-tier correspondence algorithm. It crosses the projection and patch-ownership domains and therefore should not pretend to be merely another read-model projection. Refactor the existing owned-run derivation behind a `pub(crate)` helper in `patch/edit.rs`; do not duplicate its ownership rules. The core already owns `DocumentView`, exact source spans, paths, syntax/trivia, and the rule that identities are parse-scoped (`crates/espansoconfig-core/src/model/mod.rs:35-56`; `crates/espansoconfig-core/src/patch/edit.rs:482-513`). Keeping this pure preserves §3: the core remains independently testable and has no Tauri dependency (`CLAUDE.md:43-51`).

Do **not** add a thirteenth command whose later read can silently resolve against a different revision. Compute the resolution while `conflict_after_the_lock` holds the freshly refreshed `SourceDocument`, and extend the existing conflict payload with a revision-paired, non-writing value:

```text
reapply:
  | { kind: "unsupported" }
  | { kind: "targetless" }
  | { kind: "identified", match: MatchView }
  | { kind: "refused", reason: ReapplyRefusal }
```

For creator, `targetless` means front/end need no match correspondence; an `after` placement instead resolves its anchor and returns `identified` or `refused`. For raw, `unsupported` means the operation itself has no honest reapply. Do not collapse those two facts into one arm. Each identity-based command must capture its anchor from the same old cached source it validates before calling `run_one_save`; the creator captures an anchor only for `After`. `conflict_after_the_lock` remains the single production construction site, beside the existing disk/text/revision pairing (`src-tauri/src/commands.rs:1279-1313`, `:1323-1339`). The Tauri layer is orchestration only: it selects `ReapplyMode`, hands old and fresh snapshots to the core, and serializes the result.

The TypeScript half belongs in `src/lib/browser/`, close to each surface's value. It takes an `identified` fresh `MatchView`, derives new baselines/eligibility and a fresh wire request, and returns a discriminated result such as `ready | alreadySatisfied | manualResolution | adoptionRefused`. The match editor's per-field rule belongs in `matchEditor.ts` because `FieldIntent` exists there; creation placement belongs in `matchCreation.ts`; move lowering belongs in `matchMove.ts`. Shared adoption/spend and choice production stay in `saveOutcome.ts` and `workspace.svelte.ts`.

That location matters for the repository's actual test boundary. A model test drives values and never markup; a rule put in one renderer is protected only by that renderer's mounted suite and can be omitted by another renderer while both compile (`CLAUDE.md:450-457`). Components must not decide whether a digest, trigger, field, or anchor is safe. They receive a code and invoke a transition.

## Q4 — What reapply actually applies, per surface

**Ruling: reapply preserves intent, not stale candidates; every new request is rebuilt from the adopted projection and passes the ordinary save gates.**

**Match editor.** First derive each old `FieldIntent` with the existing and only lawful reader of baseline plus buffer (`src/lib/browser/matchEditor.ts:968-1019`). Then derive `newBaseline = baselineOf(identifiedMatch)`. For each editable field, compare the old baseline state and the new baseline state by key presence, logical scalar text, and eligibility; do not compare buffers alone. Apply this table:

| Old intent | New disk field | Reapply result |
|---|---|---|
| `Unchanged` | anything | safe; emit `Unchanged`, preserving the disk field exactly |
| `Set(x)` | exactly the old baseline state | safe; emit `Set(x)` |
| `Set(x)` | already present as editable text `x` | satisfied; emit `Unchanged` |
| `Remove` | exactly the old baseline state | safe; emit `Remove` |
| `Remove` | absent | satisfied; emit `Unchanged` |
| `Set`/`Remove` | anything else, or newly ineligible | collision on that field |

Presence is load-bearing: an absent blank field is `Unchanged`, not `Set("")` (`CLAUDE.md:329-334`; `src/lib/browser/matchEditor.ts:479-515`). Eligibility is load-bearing too: a fresh projection can make a formerly editable scalar hazardous, undecodable, the wrong shape, or carriage-return-bearing. The CR refusal remains at eligibility, edit, and send (`CLAUDE.md:340-344`; `src/lib/browser/matchEditor.ts:1386-1414`). D2u remains unchanged: compare scalar source text, never an inferred boolean or number (`src/lib/ipc/types.ts:344-360`).

The checks are per field so the UI can name exactly which fields collided, but **any collision blocks the whole automatic reapply**. Do not silently save only the safe fields: *Keep my draft* claims one retained intention, and partial execution would strand the rest while looking successful. 2c-4c may provide manual per-field resolution. When every edited field is either applicable or already satisfied, rebuild the buffers over `newBaseline`, preserving the intended final states, draw a new history boundary, clear old undo/redo and consent, and submit once. Replaying old history over a different baseline would itself be a merge algorithm; the sentence beside the action must disclose that the current draft is retained but its earlier undo history is not. Old consent cannot cross: a draft submission binds candidate, base revision, acknowledgement, and generation as one claim (`src/lib/browser/draft.ts:319-343`).

**Creator.** There is no target match. Adopt the disk snapshot, retain `CreationBuffers`, set the draft base to the destination's new revision with consent withdrawn, and run the existing creation checks again: destination still exists, is a parsed writable match file with a match list; trigger and replacement remain non-empty and CR-free; and placement remains expressible (`src/lib/browser/matchCreation.ts:339-374`, `:1035-1069`). `front` and `end` keep their semantic meaning and are lowered against the new list. `after` is retained only when its anchor has an exact owned-run correspondence; otherwise manual resolution is required. Do not add a duplicate-trigger precheck: the existing candidate validation and content-addressed acknowledgement protocol decide findings for the newly derived candidate.

**Raw editor.** It is out. Its candidate is a whole document, and its writing command explicitly has no locality guarantee (`src-tauri/src/commands.rs:1673-1710`). There is no target, field intent, or operation to re-resolve, so “reapply” could mean only overwrite the new disk text with the stale whole-document string or invent a text merge. The former violates plan §6.5 and the latter is forbidden in v1 (`IMPLEMENTATION_PLAN.md:537-542`). Its honest 2c-4b surface remains 2c-4a's *Keep editing*, exact reference copy, comparison, and confirmed reload; 2c-4c owns the recovery fallback.

**Delete.** Reissue deletion only for a unique exact owned-run correspondence in the original sequence, against the new identity and revision. A unique trigger is not enough to delete a snippet whose contents changed after the person reviewed it. The existing delete confirmation must be asked again against the new live identity; comparing two values minted together proves nothing (`CLAUDE.md:317-322`). Recheck deletion eligibility, including the refusal to empty the sequence (`crates/espansoconfig-core/src/patch/edit.rs:796-821`).

**Duplicate.** Reissue only for the same strict correspondence and duplicate the newly adopted item's owned bytes—not a stale copy and never a projection rendering. This preserves the definition of true duplicate (`crates/espansoconfig-core/src/patch/edit.rs:823-847`). Its old `DuplicateKeepsTriggerDefinition` acknowledgement is invalid; the new candidate receives its own finding and must be acknowledged again because that finding is content-addressed (`src-tauri/src/commands.rs:1740-1761`).

**Move.** Resolve the moved item strictly, require its `SequenceAddress` to equal the original one, and rebuild the destination from the new sequence. That is same-sequence, not merely same-file (`CLAUDE.md:292-297`). `top` and `end` survive because they are semantic choices and are lowered afresh. `after` survives only if the anchor also has a unique exact owned-run correspondence in that same sequence. Never carry the old anchor identity or old numeric index: the UI type names an anchor, while the Rust primitive's index is explicitly in the original sequence being planned (`src/lib/browser/matchMove.ts:564-606`; `crates/espansoconfig-core/src/patch/edit.rs:500-506`). If the adopted disk already places the target at the requested destination, report `alreadySatisfied` and write nothing. Otherwise reissue a batch containing the move and nothing else, preserving R25.

## Q5 — What must not be built

**Ruling: refuse every shortcut that turns conservative reapplication into overwrite, reconstruction, guessing, or hidden partial success.**

- No three-way YAML merge, textual diff-apply, conflict-marker insertion, or line-based patching. The plan forbids automatic YAML merging (`IMPLEMENTATION_PLAN.md:537-542`).
- No raw-editor *Keep my draft*, stale `ReplaceText` retry, `saveAnyway`, `force`, or second writer outside `save_document`. The transaction's locked revision check is step 2 and all mutation remains behind the single entry point (`IMPLEMENTATION_PLAN.md:544-559`; `CLAUDE.md:385-399`).
- No projection-to-YAML emission, projection-based duplicate, reconstructed owned run, normalized newline, reindent, or scalar respelling. The projection is read-only and every untouched byte must survive (`CLAUDE.md:43-51`, `:147-155`).
- No node-id carryover, final path index identity, same-position assumption, closest trigger, edit distance, majority vote, first match, or UI-selected tie-break. Paths are positions, not identities (`src/lib/ipc/types.ts:83-94`).
- No trigger-only delete, duplicate, move, or creation/move anchor. The weaker tier is limited to match editing and is followed by field collision checks.
- No partial automatic match-editor save when one drafted field collided. That is manual resolution, not reapply.
- No cross-file or cross-sequence move and no move combined with field edits, deletes, or creates. D2r and R25 are standing constraints (`CLAUDE.md:483-490`; `src-tauri/src/commands.rs:31-39`).
- No reuse of old acknowledgement, reload confirmation, or content-addressed consent after adoption. Editing or rebasing changes the candidate and invalidates consent (`src/lib/browser/draft.ts:329-343`; `:880-905`).
- No weakening any of the three CR gates, and no inferred YAML scalar type used as correspondence evidence.
- No automatic retry loop. A reapply is one new attempt; another external change may produce another ordinary conflict. The save protocol is optimistic conflict detection, not compare-and-swap (`crates/espansoconfig-core/src/persist/save.rs:54-60`).
- No 2c-4c UI smuggled in: no save-as-new snippet, match chooser, free-form YAML recovery, or manual per-field resolution.
- No claim that `documentHasUnsavedDraft` means dirty. It measures any open match editor because the coordinator cannot observe component-local `isDirty` (`CLAUDE.md:283-290`).

## Q6 — Naming and i18n

**Ruling: add `keepMyDraft` to `ConflictChoice`, produced only by `conflictChoicesFor`; it starts a guarded reapply attempt and needs no reload-style confirmation, but destructive surfaces retain their own normal confirmation.**

The words are now available because the operation finally exists. `conflictChoicesFor` is already the sole producer and enforces ordering and draft-kind capability in one place (`src/lib/browser/saveOutcome.ts:325-361`); keep it that way. Extend `ConflictCapabilities` with an explicit reapply mode/capability, and produce `keepMyDraft` after *Keep editing* and copy, before reload. Raw declares it unavailable. Do not let each surface append the choice locally: capability was once expressed twice, which produced buttons that compiled and did nothing (`CLAUDE.md:221-229`).

There is no second “Are you sure?” merely because reload has one. Reload deliberately abandons the retained draft and resets history (`src/lib/browser/draft.ts:907-941`); reapply retains intent and goes through the ordinary save/refusal gates. It does need a one-conflict, one-spend authorization so adoption cannot install an older snapshot after a later projection, using the existing origin and generation checks rather than a parallel weaker door (`docs/decisions/2c-4a-2-notes.md:63-115`). A deletion must still repeat its deletion confirmation against the newly identified live match. That is confirmation of the destructive operation, not confirmation of the label.

The supporting sentence must say: this application will **try** to apply the retained field changes or operation to the disk version shown; it will use the newly parsed document; nothing is written when the target or a drafted field cannot be matched safely; and a later save may still be refused or conflict. For operation-choice panels, say “requested action,” not “typed text.”

It must **not** claim that the same snippet has already been found before the resolution says so; that every draft can be kept; that all fields will merge; that nothing else changed; that the next save will succeed; that the file cannot change again; that the result is a byte-for-byte copy of the old item; or that espanso will accept it. The i18n parity tests check keys and placeholders, not meaning, and this project has repeatedly shipped false guarantees in grammatically valid strings (`CLAUDE.md:247-252`; `docs/decisions/2c-4a-3c-3-notes.md:40-66`). Put refusal reasons behind typed translation accessors in both English and Spanish; components must not compose keys (`CLAUDE.md:459-465`).

## Q7 — Provoking and reading this in a window

**Ruling: extend the existing external-writer harness with fixed R0→R1 fixture replacements, one positive and one refusal case per policy; never schedule the writer by wall clock.**

The current instrument is correct: it launches a fresh bundle and synthetic config, changes language through the picker, and invokes an external filesystem writer after the surface is open (`docs/decisions/2c-4a-3c-1-instrument.md:28-53`). Its child process touches no workspace/cache, and synchronizing it from the plan rather than `sleep` makes ordering deterministic (`docs/decisions/2c-4a-3c-1-instrument.md:107-116`). Preserve that mechanism.

Do not make the launch script edit arbitrary text with a broad substitution. Seed two complete, neutral fixture variants per case and have the second writer atomically copy the selected R1 file over `conflict.yml` after the probe's “surface ready” point. The launch then byte-compares the final file with the expected post-reapply bytes. This makes both the external change and the expected patch exact.

Required readings:

1. **Exact positive:** R1 appends a document-owned comment or changes a different snippet. The target's owned-run digest is unchanged. Exercise editor, delete, duplicate, and move; for move include a reordered sequence and verify the target, not its former index, moves.
2. **Editor fallback positive:** R1 changes an undrafted field of the target while leaving the exact trigger fingerprint unique; the person's draft changes another field. Verify the external field and its spelling survive and only the drafted field is patched.
3. **Editor field collision:** R1 changes the same field the person drafted to a third value. The target is identifiable by trigger, but *Keep my draft* writes nothing and names that field. Also cover “disk already equals intended value” as `alreadySatisfied`, not a collision.
4. **Missing/changed target:** R1 removes the target, or changes both its trigger and item bytes. The control produces manual-resolution refusal and no save command is issued.
5. **Ambiguous trigger:** R1 changes the target's non-trigger bytes and adds a second match with the same exact trigger fingerprint. The editor refuses rather than choosing the old position.
6. **Move placement:** separately cover `top`/`end` after reorder, a resolvable `after` anchor, and an anchor whose bytes changed. The last refuses before writing.
7. **Creator:** use a targetless positive with `front` or `end`; then an `after` placement whose anchor is deleted or changed. Recheck the destination against R1.
8. **Raw negative capability:** provoke the existing raw conflict and verify no *Keep my draft* control appears. Its own raw-save IPC remains unusable as the second writer because it refreshes the same Rust cache; the existing instrument record explains that distinction (`docs/decisions/2c-4a-3c-1-instrument.md:86-98`).

Across the matrix, read both languages, all new refusal sentences, choice ordering, focus/scroll reachability, and the ordinary refusal/acknowledgement round after a successful reapply attempt. Byte-check that the positive cases preserve the external writer's bytes outside the new patch and that every refusal case is exactly R1 with no backup directory. A component change requires the reading to be retaken; a mounted handler test is not a screen (`CLAUDE.md:450-457`).

## Q8 — The step split

**Ruling: cut 2c-4b into three steps, keeping the dangerous correspondence proof separate from the visible promise.**

### 2c-4b-1 — correspondence evidence and conflict contract

Add the core `reconcile` primitive, exact anchor/fingerprint construction, refusal enum, corpus/property tests, and the `ConflictResult.reapply` wire field built from the same fresh snapshot as `disk_revision`. Thread the old anchor through the five identity/anchor-aware commands and `run_one_save`; raw answers `unsupported`, while a targetless creator placement answers `targetless`. Do not add a control. Rust tests must pin deletion, trigger edit, duplicate triggers, identical duplicates, sequence reorder, multiple sequences, comments that change ownership, and whole-file rewrites. TypeScript wire fixtures and dictionary-contract tests must become exhaustive. This is committable because 2c-4a behavior remains unchanged and the new payload is only evidence.

### 2c-4b-2 — reapply as browser-model transitions

Implement the shared adoption authorization and discriminated outcomes, then each surface's pure reapply transition: field table and whole-operation refusal in `matchEditor.ts`; retarget/revalidation in `matchCreation.ts`; strict target replacement in deletion/duplication; target-plus-placement rebuilding in move; raw unavailable. Reuse the existing commands and clear old consent. Keep `offersReapply: false`, following the proven pattern of building and testing an unoffered transition before drawing it (`CLAUDE.md:221-227`). Model/workspace tests must cover every Q4 row, `alreadyThere` adoption, changed projection generation, second spend, another conflict during the new save, and “no command called” on every manual-resolution arm. No component changes means no mounted or window evidence is owed in this step.

### 2c-4b-3 — one choice authority, six panels, i18n, and window reading

Add `keepMyDraft` to `ConflictChoice` and only `conflictChoicesFor`, flip capability on the five eligible surfaces, wire component handlers and `DetailPane` props, render typed readiness/refusal/collision sentences, and add both dictionaries through typed accessors. Every changed component gets a mounted interaction test proving the offered choice invokes its model transition and that raw never offers it; tests also cover delete's renewed confirmation and no-op/already-satisfied completion. Then run and record the deterministic R0→R1 window matrix from Q7, re-taking any surface whose component changes during fixes.

A two-step cut fails in one of two ways. If core and UI land together, review must simultaneously prove byte ownership, cross-revision identity, field collision, adoption spending, five handlers, and prose; the algorithmic error the split warns about hides under presentation volume. If the visible label lands before executable transitions, the UI claims the phase exists while still meaning “keep editing,” exactly the naming prohibition this phase was created to enforce. Splitting by surface is also wrong: it duplicates one confidence rule and makes the first renderer the de facto authority for the others.

## Q9 — Two or three things most likely to bite after implementation

**Ruling: audit the prose against predicates, the anchor against the exact conflict snapshot, and the move/selection state at the final synchronous write.**

**1. A sentence will claim a guarantee the predicate does not give.** The most likely versions are “same snippet” on a trigger-only provisional editor match, “all changes reapplied” when some were merely already satisfied, “nothing changed” when only the target's owned bytes matched, or “unsaved edits” where the coordinator knows only that an editor is open. Tests can pin codes and branches, not English meaning; the repository explicitly calls this its worst defect class (`CLAUDE.md:247-252`, `:283-290`). Review every new English sentence, Spanish sentence, JSDoc, test comment, and decision-record claim against the narrowest actual predicate.

**2. Evidence from R0 or R2 will be presented as if it belonged to the conflict's R1.** `conflict_after_the_lock` currently earns its disk/text/revision pairing by content-hash equality in one construction site (`src-tauri/src/commands.rs:1288-1313`). A convenient later `get_document`, or an anchor lazily derived after the Rust cache refreshed, destroys that fact. Make the old anchor before the transaction and the resolution from the exact fresh snapshot; bind the result to `disk_revision`. Then keep `adoptDiskVersion`'s generation check. Otherwise a perfectly correct matching algorithm resolves the wrong observation.

**3. Reprojection will make a correct model act on a stale UI selection or stale move anchor after an `await`.** This project has already needed the selection-follow guard in the same synchronous block as `replaceSelection`, because checking before adoption is not enough (`CLAUDE.md:266-271`). Reapply adds another awaited adoption before a replacement identity, a renewed delete confirmation, or a lowered move target is used. Revalidate document, projection generation, selected intent, target, anchor, and same-sequence relation at the call boundary; never hand the model's old `MatchId` back as the “live” one. For move, keep R25 visible in the test: correspondence and field rebasing may be computed together, but the submitted batch is still exactly one move.

**Overall VERDICT: proceed as three steps. Build conservative core correspondence first, browser reapplication second, and only then expose `keepMyDraft` on the five honest surfaces. Raw remains without it, every ambiguity writes nothing, and 2c-4c remains the sole owner of recovery when automatic reapply refuses.**
