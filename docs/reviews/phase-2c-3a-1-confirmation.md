READINESS: NOT READY

### 1. [High] Installing an unrelated document can strand a stale selection identity

**Where:** `src/lib/browser/workspace.svelte.ts:1044`, `src/lib/browser/workspace.svelte.ts:2130`  
**What:** Both `installView` and `forgetTheReplacedDocument` increment the single global `selectGeneration`, regardless of which document a pending `select()` is checking.  
**Why it matters:** Start a raw save of file B, click a snippet in file A while B’s save is pending, then let B commit. B’s invalidation increments the generation without changing the selection in A. If A’s deferred `getMatch` then reports its R0 identity stale, `select()` returns at line 1476 without repairing it. The state keeps a `MatchId` that no longer resolves—the sub-phase’s declared worst failure. The same problem occurs when a conflict or adoption installs an unrelated document. Existing deferred tests use the same document for both operations, so they do not cover this ordering. The decision record’s claim that every caller “wants” the bump is therefore wider than the code’s valid mechanism.  
**Fix:** Make projection generations document-scoped, while retaining a separate selection-intent generation for later clicks and operations that actually replace the selection. Scope `forgetTheReplacedDocument` identically. Add a deferred test that installs or forgets B while stale recovery for A is pending.

### 2. [Medium] The move revision fix was deferred on a caller that does not exist

**Where:** `docs/decisions/2c-3a-1-notes.md:331`, `src/lib/browser/workspace.svelte.ts:1545`  
**What:** The record says fixing `saveMatch` and `moveMatch` “changes a published signature whose only caller is a component this step may not touch” and names “the one caller of each” as `DetailPane.svelte:435`. That component calls only `browser.saveMatch`; repository search finds no production caller of `BrowserState.moveMatch`. `matchEditor.baseRevisionOf` is likewise unused.  
**Why it matters:** `moveMatch` still substitutes `view.revision`, so its public wrapper retains the known stale-submission shape even though fixing that method required no `.svelte` edit. A stale R0 move presented after R1 is installed receives an identity failure instead of the revision conflict describing the event. The recorded scope justification is false.  
**Fix:** Add and forward a caller-supplied `baseRevision` in `BrowserState.moveMatch` now. Leave only `saveMatch` and its actual component caller to step 2, and correct the record.

### 3. [Low] The record says `draft.ts` was unchanged after adding two transitions to it

**Where:** `docs/decisions/2c-3a-1-notes.md:72`  
**What:** The sentence “`draft.ts` is unchanged” contradicts both the diff and §5.1: the fix round added `withdrawnConsent` and `retargetedDraft`.  
**Why it matters:** It conceals that the shared draft spine used by the small and raw editors changed during the fix round—the exact regression surface this review was asked to inspect. The new functions are safe, but the audit claim is not.  
**Fix:** Say that typing-run closure remains outside `draft.ts`, while the fix round added two explicit consent/retargeting transitions.

### The six, confirmed

1. **closed** — destination and genuine placement changes withdraw the entire prior attempt and consent; destination changes also retarget the base.
2. **closed** — creation and deletion forward the supplied base revision unchanged.
3. **closed** — both adoption helpers require document, revision, and node; ordinary save and move adoption still works.
4. **partly closed** — same-document save adoption cancels the stale lookup correctly, but the global generation introduces the cross-document High regression above.
5. **closed** — the retained-session test genuinely passes an identity from a reprojected document, and the module explicitly admits that argument provenance is not enforced.
6. **closed** — summaries drive the destination list; `couldNotBeRead` is typed, localized in both dictionaries, and rendered through the typed accessor.

### Not findings

- Initial workspace loading does not call `installView`; `open()` performs its own single generation invalidation. `applyRepair` also safely invalidates other lookups after its own final generation check.
- A caller can provide mismatched `baseRevision` and identity values, but the core refuses them as a revision conflict or identity error rather than resolving a stale node. The wrappers correctly avoid inventing provenance their types cannot prove.
- `retargetedDraft` is imported only by creation, and destination/placement changes are refused while submission is in flight. The raw and small editors do not reach it.
- The new deferred create/delete tests genuinely interleave: adoption completes before the deferred `getMatch` is resolved.
- Localization uses exhaustive typed key functions and accessors; no built localization key was introduced.

Codex session ID: 019fc78e-1819-7922-9f57-5c0d023c0f76
Resume in Codex: codex resume 019fc78e-1819-7922-9f57-5c0d023c0f76
