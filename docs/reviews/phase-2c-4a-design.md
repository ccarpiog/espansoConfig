# Phase 2c-4a — conflict capture and preservation design consult

## VERDICT

2c-4a is not merely a matter of adding disk text and two buttons: the command layer already captures a fresh disk projection, but the frontend immediately installs it, so the two sides are not actually kept separate. The frontend install on a conflict must be deferred until an explicit, confirmed reload; the command-layer refresh that creates `ConflictResult.disk` must remain. The minimum honest comparison is the retained draft or operation summary beside the exact whole-file disk text, with revisions always shown and an explicit unavailable state when that text cannot be obtained; 2c-4a must not identify a corresponding match across revisions, generate YAML from a projection, compute a diff, or reapply anything. All five match-level surfaces need a real reload path, but only the match editor and creator have user-authored text worth offering through *Copy draft*.

## Q1 — Scope

**Ruling: the command half of “load the disk version separately” exists; the frontend half does not. The remaining work is broader than disk-text capture.**

The save transaction correctly detects the mismatch under the path lock (`crates/espansoconfig-core/src/persist/save.rs:1429-1443`). After the lock is released, `conflict_after_the_lock` performs a fresh `workspace.refresh`, pairs its projection with that projection's revision, and returns both (`src-tauri/src/commands.rs:1289-1302`). The wire and presentation model already retain that projection separately as `ConflictResult.disk` / `ConflictModel.disk`, while retaining the submitted `Draft<T>` independently (`src/lib/ipc/types.ts:1641-1655`; `src/lib/browser/saveOutcome.ts:236-276`). That much of the scope is real.

The live frontend does the opposite of “separately”: every wrapper calls `installView(answer.value.disk)` and `repairAfter(...)` before the component sees the conflict (`src/lib/browser/workspace.svelte.ts:2086-2097`, `:2184-2192`, `:2265-2272`, `:2328-2334`, `:2451-2462`, `:2538-2548`). Thus the draft remains in the component while the snippet list, selection, and live projection have already crossed to the disk observation. The disk model is carried, but it is not preserved as a second side.

2c-4a must deliver all of the following as one protocol:

- retain the draft and its history unchanged, with its original `baseRevision`; `Draft.baseRevision` is deliberately captured at draft start and not refreshed before save (`src/lib/browser/draft.ts:273-317`);
- retain the conflict's fresh `DocumentView` as the disk-side snapshot without installing it into the live frontend workspace;
- obtain and retain an exact disk-text snapshot for comparison, tied to the disk observation as discussed in Q6;
- draw both sides, all three revisions, `changedAgain`, copy status, and text-unavailable/refused states;
- keep *Keep editing* non-destructive;
- make a confirmed *Reload disk version* the sole frontend transition that installs the disk projection, repairs selection, and abandons or replaces the operation's draft as appropriate.

It must not add `saveAnyway`, retry the stale candidate, reload automatically, clear dirty state on conflict, identify/rebase the intended match, emit YAML from a projection, or call any control *Keep my draft*. The first two prohibitions are explicit in `saveOutcome.ts:119-138`; identifying and reapplying is 2c-4b, not this phase (`docs/decisions/2c-split-notes.md:152-166`).

## Q2 — The pre-emptive install

**Ruling: it is a 2c-4a defect. Defer only the frontend projection install; keep the command-layer refresh and cache coherence.**

The case for keeping the current behavior is substantial. `conflict_after_the_lock` has already refreshed the Rust workspace cache, so installing the returned projection makes the frontend agree with what subsequent backend identity checks will use (`src-tauri/src/commands.rs:1289-1302`). The six wrappers remain symmetric, their existing selection-repair machinery runs, and the raw editor's `loadDiskVersion` currently only reloads its local draft because it assumes workspace adoption already happened (`src/lib/browser/rawEditor.ts:779-805`). Eager installation also makes the main list describe the latest observation rather than the stale base.

Nevertheless, it violates the named scope and produces the more dangerous user experience. A conflict writes nothing, yet the list can reorder and the selection can move before the person chooses anything. The draft is then displayed against a live projection that no longer describes its identity or baselines. The code already exposes the consequence: move and duplication infer `invalidated` from the conflict arm solely because their wrappers installed the disk projection while reporting `adoption: notOwed` (`src/lib/browser/matchMove.ts:1301-1371`; `src/lib/browser/matchDuplication.ts:779-843`). That is not disclosure; it is an unsolicited state transition.

The repair is a boundary change, not removal of the fresh read:

1. The Rust workspace still refreshes and returns `disk` after the lock. That is required for the two-observation truth and backend cache coherence.
2. A frontend conflict arm captures the result and disk text but does not call `forgetTextOf`, `installView`, `repairAfter`, or viewer-refresh paths that replace the base-side display.
3. A confirmed reload invokes a single workspace adoption operation that installs the carried disk projection and repairs selection. The component then either loads an exact disk value (raw editor) or closes the match-level operation, as ruled in Q3.
4. The raw transition must be rewired so workspace adoption and `loadDiskVersion` form one deliberate operation. Its current assumption that adoption happened before the answer arrived cannot survive this ruling.
5. Move and duplication must stop treating `result.outcome === 'conflict'` itself as invalidation. Invalidation should follow actual projection adoption, not the mere existence of a separately held snapshot.

The temporary disagreement between the frontend list and disk is intentional and disclosed by the conflict panel; it is the only way to keep the two observed sides genuinely separate. Subsequent stale writes remain safe because the frozen base revision still reaches the locked check, and the five identity-based commands also check their cached projection through `view_at` (`src-tauri/src/commands.rs:783-796`).

## Q3 — Widening `CONFLICT_CHOICES` at match level

**Ruling: all five match panels get an explicit confirmed reload path, but only two get `copyDraft`. The deciding rule is whether the draft contains user-authored text that a clipboard can preserve truthfully.**

| Surface | First step | Confirmation step | Reload result |
|---|---|---|---|
| Raw editor | Keep editing · Copy draft · Reload disk version | Keep editing · Copy draft · Confirm reload | Install `conflict.disk`; seed a clean raw draft from the exact disk text. |
| Match editor | Keep editing · Copy draft · Reload disk version | Keep editing · Copy draft · Confirm reload | Install `conflict.disk`; close the editor. Do not try to find and re-seed “the same” match. |
| Creator | Keep editing · Copy draft · Reload disk version | Keep editing · Copy draft · Confirm reload | Install `conflict.disk`; close the form. There is no disk-side `CreationBuffers` value to reload. |
| Mover | Keep editing · Reload disk version | Keep editing · Confirm reload | Install `conflict.disk`; close the mover. The chosen placement is an operation choice, not authored text. |
| Deleter | Keep editing · Reload disk version | Keep editing · Confirm reload | Install `conflict.disk`; close the deleter. |
| Duplicator | Keep editing · Reload disk version | Keep editing · Confirm reload | Install `conflict.disk`; close the duplicator. |

Confirmation remains for all six because reload replaces the window's projection and abandons the open operation; however, the warning for mover/deleter/duplicator must say that plainly rather than falsely claiming typed text will be lost. The existing one-conflict confirmation token is the right enforcement mechanism: a token issued for a different conflict is rejected (`src/lib/browser/saveOutcome.ts:459-516`). For match-level operations, do not force `reloadDiskVersion<T>(..., value: T)` where no truthful disk-side `T` exists. That generic transition fits raw text; match-level reload is “confirm abandonment, then adopt the disk document and close,” not “manufacture a clean `Draft<MovePlacement>` or `Draft<MatchId>` from disk.”

This is not five ad hoc decisions. `MatchBuffers` and `CreationBuffers` contain authored strings (`src/lib/browser/matchEditor.ts:506-536`; `src/lib/browser/matchCreation.ts:188-205`). `MovePlacement` is a positional selection (`src/lib/browser/matchMove.ts:547-555`), and deletion and duplication use `Draft<MatchId>` as protocol carriers rather than editable content (`src/lib/browser/matchDeletion.ts:300-335`; `src/lib/browser/matchDuplication.ts:15-35`, `:389`).

The duplicator's current “spent on conflict” behavior is not a reason to omit reload. It is a consequence of the eager install and must disappear with Q2: `invalidated` currently includes `result.outcome === 'conflict'` (`src/lib/browser/matchDuplication.ts:825-829`).

## Q4 — What “copy” means where the draft is not text

**Ruling: offer a labelled, non-YAML reference copy only for `MatchBuffers` and `CreationBuffers`; do not offer `copyDraft` for `MovePlacement` or `MatchId`.**

- **`MatchBuffers`:** copy all editable fields in the model's stable field order, each with a label, its exact current `text`, and an explicit present/marked-for-removal status. A removed field retains its text in the buffer, so omitting either the text or the `removed` flag would not copy the drafted value (`src/lib/browser/matchEditor.ts:506-536`). The clipboard result is a human reference, not an import format.
- **`CreationBuffers`:** copy the exact `trigger` and `replace` strings under labels. The chosen destination is not in `Draft<CreationBuffers>`; it should remain visible in the panel, or be included as separately labelled context only if the conflict state freezes that context. Do not silently imply that `copyOfDraft` copied the destination when it can return only `conflict.draft.value` (`src/lib/browser/saveOutcome.ts:449-451`).
- **`MovePlacement`:** do not offer *Copy draft*. “Top,” “end,” or “after this session-local `MatchId`” is not authored text, and a localized sentence would be a description that cannot restore the operation. Show the chosen placement in the retained panel instead.
- **`MatchId`:** do not offer *Copy draft*. For deletion and duplication it is an opaque, revision-scoped identity, not user content (`src/lib/ipc/types.ts:411-423`). Copying its JSON would expose an implementation token while preserving nothing useful.

A labelled plain-text rendering is honest if its UI and tests call it a reference copy and it preserves every copied string exactly. It must never be YAML. `MatchView` itself warns that projections other than `source_text` are incomplete (`src/lib/ipc/types.ts:495-525`), and the project convention already rules that projection-based emission drops comments, key order, and scalar spelling (`CLAUDE.md` §6). Serializing `MatchBuffers` as YAML would therefore repeat the exact preservation-promise mistake 2c-3c was created to prevent.

## Q5 — What “compare” means, minimally and honestly

**Ruling: pick (c), exact whole-file disk text through `SourceText`, beside the draft/operation summary. Keep revisions as metadata and fallback, not as the comparison.**

Ranking for this phase:

1. **(c) Whole disk text through `SourceText`.** It shows the exact available text without claiming that an identity survived, and the renderer already preserves visual line boundaries and exposes invisible characters (`src/lib/components/SourceText.svelte:1-47`).
2. **(a) Revisions only.** Always keep the current three lines, including the `found !== diskRevision` warning (`src/lib/browser/saveOutcome.ts:361-389`), but hashes alone do not satisfy the promised human comparison.
3. **(b) “The same match” from the disk projection.** Useful only after a trustworthy cross-revision correspondence exists. It does not exist now: `MatchId` includes revision and parse-local node identity (`src/lib/ipc/types.ts:411-423`), while the editor session retains that ID and field baselines, not a stable cross-revision key (`src/lib/browser/matchEditor.ts:581-650`). Matching by index, node number, trigger, or projected fields would silently choose the wrong snippet after an external insertion, reorder, edit, or duplicate. That is the identity/confidence work reserved for 2c-4b.
4. **(d) A textual diff.** It is more machinery than this phase needs, and no repository helper exists. It adds line splitting, alignment, Unicode, newline, and large-document policy to a phase whose failure mode is data loss.

The draft side is the raw text, labelled field reference, or operation summary ruled in Q4. The disk side is the whole file text. If the prior match was deleted, moved, duplicated, or edited externally, say that this application cannot identify a corresponding match in this revision; do not draw empty disk fields and do not select a match heuristically. For mover/deleter/duplicator, show the retained operation summary and its old revision-scoped identity context, then let the person inspect the whole disk file. Comparison is visual and read-only; no result of it is fed into a write.

## Q6 — The `conflictText` asymmetry

**Ruling: the five match wrappers should capture disk text too; `ConflictModel.disk` remains the reload payload and metadata source, but it cannot substitute for whole-file text. Strengthen the capture so the text is explicitly revision-bound.**

The current asymmetry is real: `conflictText` is keyed by document (`src/lib/browser/workspace.svelte.ts:1171-1178`), but only `saveRawDocument` calls `captureTheDiskText` (`:2538-2548`, `:2960-2973`). `DetailPane` passes `diskText` only to `RawEditor`, while every match component receives no disk-side prop (`src/lib/components/DetailPane.svelte:204-205`, `:655-735`). Step 2 must pass the captured state to all five match panels.

Do not use `ConflictModel.disk` as though it were file text. `DocumentView` contains a projection and a list of matches (`src/lib/ipc/types.ts:558-615`); even each `MatchView.source_text` is only that mapping's owned slice and explicitly excludes a comment on the line above (`src/lib/ipc/types.ts:495-525`). It cannot display the entire disk file and cannot identify “the same match” without violating Q5.

There is one necessary correction before simply fanning out the current helper. `documentText` returns `CommandResult<string>` with no revision (`src/lib/ipc/commands.ts:320-326`), `RawDocumentText` also carries no revision (`src/lib/browser/rawDocument.ts:91-128`), and the existing workspace test explicitly records that text and revision come from separate reads (`src/lib/browser/workspace.test.ts:4250-4255`). The conflict capture must therefore carry the revision it claims and reject or label any text that cannot be established as belonging to `conflict.diskRevision`. Prefer a single revision-bound conflict snapshot from the command/cache boundary; if that is not implemented, the UI must call the text a later cached observation rather than placing it under the `diskRevision` line as if the type proved the pairing. The precise Rust accessor for producing that paired value is **uncertain** from the cited APIs and should be settled in 2c-4a-1 rather than guessed here.

When disk text cannot be obtained, draw a localized unavailable/refused state and the typed failure, while retaining the three revisions, path, draft, copy action where applicable, and *Keep editing*. Do not render an empty source box. For match-level panels, confirmed reload may still install `conflict.disk`, so text failure need not disable reload. A carriage return is displayable by `SourceText`; it should not disable match-level reload. It continues to disable raw-editor confirmation because a `<textarea>` cannot round-trip that disk text, exactly as `loadDiskVersion` already enforces (`src/lib/browser/rawEditor.ts:779-805`).

## Q7 — Provoking a real conflict in a window

**Ruling: all six can be provoked without production changes. The second writer must modify the scratch file directly, not call this app's raw-save IPC.**

The earlier move and duplication readings used raw-save IPC as the second writer. That command refreshes the same Rust workspace cache, so `view_at` sees a newer cached projection and answers `identityStaleRevision` before the transaction (`docs/decisions/2c-3b-2-window-reading.md:55-64`, `:204-223`; `docs/decisions/2c-3c-3-window-reading.md:636-660`). That evidence did not prove that a true conflict is unreachable; it proved that an in-process second writer is the wrong instrument.

Use a fresh synthetic configuration outside the repository for every launch. Open the target surface at revision R0. Then, while the panel remains open and without invoking any app command that reloads the document, use a shell/editor process to append a valid YAML comment to that exact file and flush/close it, producing R1. The frontend and Rust workspace cache remain at R0. On the five match commands, `view_at` therefore sees cached R0 equal to the submitted base and proceeds (`src-tauri/src/commands.rs:783-796`); the core's locked disk read then sees R1 and returns the real revision mismatch. Raw save has no `view_at` and goes directly to the same locked check (`src-tauri/src/commands.rs:1248-1265`).

Run that common recipe as follows:

1. **Raw editor:** open raw editing, change any character in the draft, externally append the comment, then press Save.
2. **Match editor:** edit one eligible field, externally append the comment, then save the match.
3. **Creator:** choose the target file and placement, enter valid trigger and replacement text, externally append to that target file, then add the snippet.
4. **Deleter:** open deletion and reach its confirmation prompt, externally append to the snippet's file, then confirm deletion.
5. **Mover:** choose a different valid destination, externally append to the file, then move.
6. **Duplicator:** open the panel, externally append to the file, then duplicate. The locked revision check precedes the semantic gate, so the normal duplicate-trigger acknowledgement must not appear before this conflict.

For every run, verify that the panel's outcome is `conflict`, the external comment remains byte-identical, the intended edit/create/delete/move/duplicate did not occur, and the retained draft or operation is still present. Exercise copy and confirmed reload where the surface offers them, and byte-check clipboard text and disk. Cover each surface in at least one running-window launch and cover every new English and Spanish string across the matrix. No canned answer is needed for the central outcome once the second writer is a direct filesystem process.

## Q8 — The step split

**Ruling: cut 2c-4a into three steps.**

### 2c-4a-1 — conflict ownership and snapshot contract

Define the two-side state and the revision-bound disk-text contract; remove eager frontend adoption from the conceptual protocol; define per-surface copy/reload capabilities and confirmation transitions; adjust the raw reload orchestration; and remove conflict-as-invalidation from move/duplication. This step has no new visible controls. Review it against:

- the two-observation wire semantics in `src-tauri/src/save.rs:143-184` and `src-tauri/src/commands.rs:1267-1302`;
- draft immutability/history and confirmation branding in `draft.ts:273-317`, `:900-942` and `saveOutcome.ts:449-516`;
- workspace/model tests proving that conflict does not call frontend `installView`, that *Keep editing* preserves the exact draft and base, and that only confirmed reload adopts `disk`;
- the absolute absence of save-anyway, rebase, target matching, and *Keep my draft*.

### 2c-4a-2 — per-surface comparison, copy, and reload integration

Implement the labelled copy renderers, disk-text capture for all wrappers, workspace adoption callback, per-surface close/reseed behavior, unavailable/CR handling, and the props from `DetailPane`. Review it against model and workspace suites for all six surfaces, including target deleted/moved, `found !== diskRevision`, text refusal, wrong confirmation token, copy failure, and selection repair occurring only after confirmed reload.

### 2c-4a-3 — components, i18n, mounted evidence, and window reading

Render the six panels, new English/Spanish keys, `SourceText`, capability-specific choices, confirmation screens, and copy-result disclosures. Every newly offered `ConflictChoice` arm must act in the same change; the current exhaustive switches explicitly do not protect against a newly offered no-op (`MatchEditor.svelte:389-405` and its four siblings). Review first against mounted jsdom tests for each component, including real clipboard fallback behavior and button enablement. Then perform the six direct-filesystem conflict launches from Q7 in a running WKWebView, record both languages across the matrix, and byte-check both sides. The window reading belongs in this final step and is part of its exit, not a follow-up after the phase is declared complete.

## Q9 — Two things likely to bite after implementation

**1. There are currently two authorities for conflict choices.** Generic `describeConflict` installs the global three choices in every `ConflictModel` (`src/lib/browser/saveOutcome.ts:285-302`, `:380-389`), while each match model ignores that field and exposes a local `['keepEditing']` (`matchEditor.ts:1600`, `matchCreation.ts:1256`, `matchDeletion.ts:692`, `matchMove.ts:1590`, `matchDuplication.ts:1032`). That split is why a newly offered button can compile and do nothing. 2c-4a should make capability/step choices come from one surface-owned model authority rather than widening five arrays and trusting five components to stay synchronized.

**2. “Disk text at revision R” is not presently a typed fact.** `conflictText` stores only document plus `CommandResult<string>` (`workspace.svelte.ts:1175-1178`), even though the conflict UI places that text beside `diskRevision`. Once five more wrappers depend on it, a concurrent refresh or reused viewer answer can make a later cached text look like the conflict snapshot. Bind text to the revision at the capture boundary and test that mismatch explicitly; do not rely on call ordering as the proof.

**Overall VERDICT: proceed as a three-step 2c-4a, with deferred frontend adoption, exact whole-file comparison, capability-specific copy, confirmed reload, and six real-window conflict runs. Do not implement cross-revision match identification, YAML emission, diffing, retry, or reapplication in this phase.**
