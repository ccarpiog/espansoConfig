Reviewer: autoclaude adversarial reviewer

Scope: `4f1fdb3` restricted to `src/lib/browser/workspace.svelte.ts`,
`src/lib/components/MatchCreator.svelte`, `src/lib/components/DetailPane.test.ts`.

## BLOCKERS

None.

## SHOULD-FIX

**1. `MatchCreator.svelte:392-394` — "not reached through `current` at all" is false.**
Claim: the `:2581` read "is not reached through `current` at all". Derived: the
`context.surfaces` that read consults *is* `current`'s. `RestorePane.svelte:340`
builds `surfaces: surfaces()` inside `current`'s `$derived.by`; `runRestore` does
`const now = current;` (`:509`) and passes `now.context.surfaces` to `restore(...)`
(`:511`); `workspace.svelte.ts:3319-3322` rebuilds a `RestoreContext` from that very
array and hands it to `sendRestore` → `permitHolds` → `competingSurfaceFor`. Only the
`observed` half is re-read by the coordinator. True statement: the *call* is not made
from inside `current`'s derivation; the *surface list* comes through `current`.
Derivation: `sed -n '336,343p;505,514p' src/lib/components/RestorePane.svelte`,
`sed -n '3316,3335p' src/lib/browser/workspace.svelte.ts`.

**2. `MatchCreator.svelte:392-395` — "**The second** is the read that decides whether
the restore is written … a claim that names only the drawn refusal describes the
display and not the spend."** Derived: `:1993` is not display-only. `restoreRefusal`
is called by `canPrepareRestore` (`restore.ts:2009`), which gates `prepareRestore`
(`:2095`) **and `confirmRestore` (`:2397`)** — the call that mints the permit
(`RestorePane.svelte:510`). A competing surface found at `:1993` stops the write
before `:2581` is ever reached, so `:1993` also decides whether the restore is
written. This contradicts a live comment the fix did not update:
`RestorePane.svelte:106-111` — "`restoreView`, and through it `restoreRefusal` and
`canPrepareRestore`, are derived from that one value, and `prepareRestore` and
`confirmRestore` are handed the very same object. Four gates…".
Derivation: `rg -n 'restoreRefusal|canPrepareRestore|competingSurfaceFor' src/lib/browser/restore.ts`.

**3. `workspace.svelte.ts:3414-3418` (and `:1609-1612`) — the two-audience split omits
`$effect` and template reads.** Claim: "the cost depends on who is asking … For an
imperative caller the cost is the *invalidation* alone — it calls, so it gets today's
number regardless. For a `$derived` the cost is the *value* as well." Derived: an
`$effect` is a caller that calls, so the sentence classifies it under "imperative" and
gives the wrong answer — with no invalidation it never re-runs, so whatever it
maintains stays stale, exactly as the derived's cached number does. The same function
says so 15 lines above: `:3399-3400`, "subscribes a caller's `$derived` **or
`$effect`**", as does the sibling door's JSDoc at `:1570`. A template read is a render
effect and behaves the same. The fixed sentence is narrower than the code it describes
and than its own file.

## NIT

**4. `workspace.svelte.ts:1613-1615`** — "is **the one caller** for which 'the
invalidation and not the value' is the whole truth" contradicts `:1594-1596` in the
same docblock: "The callers it has today are cases in `DetailPane.test.ts`". Those are
imperative callers for which it is equally the whole truth, and there is today no
coordinator caller at all (`rg -n 'writeSurfaceGeneration\(\)' src/` finds no
production reader).

**5. `DetailPane.test.ts:1140-1146`** — "it … can fail only if registering an
unknown-target creator wrongly *draws* a refusal" is stated of the first half, but the
first half is two assertions (`:1169-1170`), and
`expect(control(…,'browser.restore.prepare').disabled).toBe(false)` fails for any other
refusal arm — `noCandidate`, `targetMoved` — with no creator refusal drawn. Also
`:1145-1146` ("Everything that makes this case evidence … is below the
`replaceTarget`") sits against `:1143` ("establishing the starting screen"): delete the
first half and the `toContain` at `:1176` no longer shows a *change*.

**6. `DetailPane.test.ts:1183`** — "Released before the pane stops, as the sibling case
above does". The sibling's `lease()` (`:1110`) is an **observed step**: `flushSync()`
and four assertions follow it (`:1111-1115`), and its own comment calls it "the other
half of the same claim". Here it is bare cleanup. The added `lease()` itself is
correct: it is after `registered(pane.state)` (`:1177-1180`), so it masks nothing.

## Verified as claimed

- Two production readers of `competingSurfaceFor`, at `restore.ts:1993` and `:2581`;
  `permitHolds` called by `sendRestore` at `:2663`. Exhaustive today — every other
  match is a test or a comment (`rg -n 'competingSurfaceFor'`).
- Six early returns in `restoreRefusal` before the call (`alreadyRestored`, `readOnly`,
  `inFlight`, `conflictShowing`, `noCandidate`, `targetMoved`), so "one of six" and "an
  open restore with no candidate never reaches the call" are both right.
- `targetingSurfaceFor` still has no production caller.
- `$derived` memoization: Svelte 5 deriveds are lazy and version-checked, so "keeps the
  number it cached until some other dependency moves it" holds.
- `@returns` present; JSDoc conventions met.

## NOT-VERIFIED

- The frontend gates (`npm run check` / `npm test` / `npm run build`) — the orchestrator
  is re-measuring them; not re-run here.
- `cargo` — excluded by the brief.
- That `void surfaceGeneration` compiles to `$.get(...)` — taken from the previous
  round's measurement, not re-compiled.

## Where it is thin

1. **`MatchCreator.svelte:389-397` characterises two call sites whose reachability it
   never traced.** — *actionable* (record/comment in a source file; findings 1 and 2).
2. **No executable test pins any of these sentences.** Every claim here is prose; the
   suites check parity and behaviour, never attribution. — *recorded only*.
3. **`RestorePane.svelte:106-111` is the live comment finding 2 contradicts.** Whichever
   side is corrected, both must be read together. — *actionable*.
4. **The `$effect`/template audience is unnamed in `writeSurfaceGeneration()`'s comment
   while named in `openWriteSurfaces()`'s** — the two doors' comments have drifted. —
   *actionable*.
5. **`writeSurfaceGeneration()` still has no production reader**, so every sentence
   about its audience describes a caller that does not exist. — *recorded only*.
