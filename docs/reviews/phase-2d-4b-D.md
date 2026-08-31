Reviewer: autoclaude adversarial reviewer

# Phase 2d-4b-D — review of 2d-4b-C's fix

### Scope

`git show e510819 -- src/` → **4 hunks** (`grep -c '^@@'` = 4): `workspace.test.ts` +20/−13 (two),
`DetailPane.test.ts` +9/−3, `RestorePane.test.ts` +9/−3. Every `+`/`−` line under `src/` is a comment
line. Arithmetic done before reading any sentence about it.

### Derivations

1. **Sixteen / thirteen / three / two — holds.** `workspace.svelte.ts:45-60` names sixteen wrappers;
   `REAL_COMMANDS` (`:315-329`) takes thirteen, `REAL_BACKUP_COMMANDS` (`:387-391`) the other three;
   `createBrowserState` (`:1506-1510`) takes two command surfaces plus `report`.
2. **The partial trap — holds.** Both suites hoist a rejecting-and-recording `invoke` mock
   (`DetailPane.test.ts:66-72`, `RestorePane.test.ts:117-124`); `invoked.mockClear()` is in
   `beforeEach` and the `afterEach` asserts only `drains`. Six `expect(invoked)` sites, all
   `.not.toHaveBeenCalled()`. Both mount a real `BrowserState` (`DetailPane.test.ts:285`,
   `RestorePane.test.ts:544`, inside `mountRestore` 454-598). `workspace.test.ts` mocks
   `@tauri-apps/api/core` nowhere. `drainExternalChanges` → `call()` → `invoke`, so the module route
   does reach it.
3. **Nothing unbounded survives.** Every `drain` sentence in all three files carries the injected
   bound; both stub indirections ("bounded as the count's own doc comment states") and
   `workspace.test.ts:316`'s ("stated in full where the count is incremented", `:453-469`) resolve.
4. **186 is live** — `npx vitest run src/lib/browser/workspace.test.ts` → 186 passed. 254's
   attribution does not hold (F2).

### Findings

**F1 — Medium, source — `src/lib/browser/workspace.test.ts:465-466`.** *"This file mocks no
`@tauri-apps/api/core`, so nothing else in it notices such a call either — unlike the two component
suites, which reject at `invoke`."* The named discriminator does not discriminate. This file has no
`@vitest-environment` docblock, so it runs in node; the real `invoke`
(`node_modules/@tauri-apps/api/core.js:201-203`) dereferences `window.__TAURI_INTERNALS__` and so
rejects here too. Both sides reject, and `call()` (`src/lib/ipc/commands.ts:249-254`) catches either
rejection and returns a failure a fire-and-forget drain discards, so neither file notices by
rejecting. The only asymmetry is that the component mock **records on `invoked`** first — which the
same fix's own comments say catches nothing file-wide. A correct version: *"…unlike the two component
suites, whose mock records on `invoked` before rejecting; the rejection itself is caught by `call()`
in either file and notices nothing."*

**F2 — Low, source — `src/lib/browser/workspace.test.ts:461-464`.** *"Phase 2d-4b-B measured what it
costs: … 186 passed, 0 failed, where the same probe through the injected surface gave 254 failures."*
The 254-failure probe was run at **2d-4b**, not 2d-4b-B: `2d-4b-notes.md:339-341` (§5) is where it is
recorded, and §8.2 says so in as many words — *"The probe §5 actually ran went through the injected
surface and produced 254 failures"*. 2d-4b-B measured 186 and only cited 254. Correct version: name
2d-4b for the second figure. Directions and magnitudes are right; only the agent is wrong.

**F3 — Low, record — `docs/decisions/2d-4b-notes.md:588` and `:596-597`.** Eight line citations in
§9.2, written in the present tense about the post-fix tree, are stale by exactly **+6** — the fix's
own net line delta in each component file. `DetailPane.test.ts:279`→285, `RestorePane.test.ts:538`→544,
and the six `expect(invoked)` sites `528, 802, 905, 935, 962, 1078` → `534, 808, 911, 941, 968, 1084`.
`RestorePane.test.ts:802` now points at a fixture string. `phase-2d-4b-C.md:44` carries the same two
numbers legitimately — that report was written against the pre-fix tree. This is the fourth
consecutive round on this phase to find a residue left by the previous fix, and here the fix
invalidated its own citations.

Nothing else found. No High. No executable line changed; no gate figure can move.

### Where this round is thin

1. **F1 is a judgement about a clause's contrast, not a compile error — *actionable*.** It names a
   false statement in a source file's comment; it is not a correctness defect in executable code, so
   §7.3's blocker clause does not bind. Fix now or a later phase may adopt it.
2. **"254 failures across the three suites that count" is unverified — *recorded only*.** Re-running
   that probe was outside this round's permitted commands, and the record never lists the failures per
   file. The 254 could span suites beyond the three.
3. **`invoked`'s six sites were enumerated by `rg`, not by any assertion — *recorded only*.** A
   seventh could appear and no gate would notice; already recorded at §9.8.
4. **Twelfth consecutive Opus round, no second provider — *recorded only*.**
5. **Not checked: whether `254` and `186` remain true of today's tree — *recorded only*.** 186 was
   re-measured; 254 was not, and cannot be without mutating source.
