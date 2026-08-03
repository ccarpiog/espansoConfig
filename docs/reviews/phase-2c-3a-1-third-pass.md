READINESS: NOT READY

### 1. [Low] The documented selection-write invariant omits `open()` and is not type-enforced

**Where:** `src/lib/browser/workspace.svelte.ts:1011`  
**What:** The comment says every write to `selected` uses `replaceSelection` except `select()`’s own. `open()` also assigns directly at line 1475. Both exceptions are currently safe, but the stated exhaustive invariant is false, and TypeScript does not prevent another direct assignment.  
**Why it matters:** A maintainer relying on this claim could add `selected = next` without an intent bump. If `select(A)` is awaiting `get_match`, that assignment chooses B, and A’s stale answer can subsequently repair back over B. The present `open()` path does not have this defect: it increments `selectGeneration` at line 1454 before clearing the map and selection.  
**Fix:** Amend the comment to enumerate both deliberate exceptions and state that this is a manually maintained call-site invariant, not one enforced by TypeScript.

### Not findings

- The behavioral change is sound. The only direct assignments are:

  - `replaceSelection` itself at line 1028;
  - `open()` at line 1475, covered by the global bump at line 1454;
  - `select()` at line 1593, covered by its entry bump at line 1566, with no intervening `await`.

- All eleven `installView` calls have the correct document scope. They comprise two `applyRepair` arms, the five conflict arms, the move/save adoption helper, creation adoption, deletion adoption, and whole-document replacement adoption. None replaces identities belonging to another document. Every conflict arm performs `installView(disk)` and `repairAfter(disk)` synchronously, so same-document pending selection work is cancelled before any continuation can run.

- All four syntactic callers of `forgetTheReplacedDocument` are correctly scoped: the three committed-adoption failure paths and `adoptTheReplacedDocument`. Dropping B neither invalidates A’s projection nor cancels A’s lookup unless the operation also deliberately replaces the selection.

- Clearing `projectionGenerations` in `open()` is safe. Explicitly: a lookup captures intent `n` and projection `p`; `open()` changes the intent to `n + 1` and clears the map. Even if the new workspace reuses the same numeric document ID and its projection generation again reads as `p`, the lookup still fails the intent comparison. The intent counter is not reset.

- The unseen-document default is safe. Initial loading does not populate the map, so a selection can capture generation zero. Its first subsequent `installView` sets that document to one, making the projection comparison unequal.

- The projection half of `selectionLookupIsStale` is currently redundant in every reachable ordering, not merely those tested. A live lookup synchronously makes its document the held selection before awaiting. Every same-document `installView` caller then synchronously repairs or replaces that selection, while `forgetTheReplacedDocument` drops it; each action bumps the intent counter. If the selection had already moved elsewhere, that earlier movement already bumped the intent. Consequently there is no current ordering where only the projection comparison catches staleness, and therefore no honest missing test that can isolate it. The cross-document test proves the corrected scope, but does not make the projection comparison load-bearing. Retaining it is harmless defensive redundancy.

Apart from the inaccurate invariant comment, this pass found no selection-stranding or cross-document invalidation defect.

Codex session ID: 019fc7a8-6503-7de2-9688-0fc77bb7ca2b
Resume in Codex: codex resume 019fc7a8-6503-7de2-9688-0fc77bb7ca2b
