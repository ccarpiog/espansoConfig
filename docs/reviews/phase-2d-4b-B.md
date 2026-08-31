Reviewer: autoclaude adversarial reviewer

# Phase 2d-4b-B — review of 2d-4b's fix round

### Scope

The eight files named in the brief, in their current state at `82753f4` (tree clean). No `cargo`,
no full `npm test`, no `npm run build` — the orchestrator's figures are taken as given.

Three mutations were made and reverted; `git status --short` is empty and was confirmed twice.

### Derivations

**Claim 1 — the 49 builders and the runtime probe. Holds.** `CODE_NAMESPACE_KEY_BUILDERS`
(`codes.ts:1721`) has exactly 49 entries (counted mechanically), `CODE_NAMESPACES_WITHOUT_A_BUILDER`
3, and `codes.test.ts:1085` compares 52 against `dictionaryCodeNamespaces()` in both directions with
a duplicate check. Re-derived the mutation: `addedContent: changedContentKey` →
`AssertionError: addedContent produced code.changedContent.projected`, 1 failed / 68 passed. The
sample table's own guard (`codes.test.ts:1162`) compares key sets both ways, so a stale extra entry
is not invisible; the compile half is real too — deleting `writeStep: 'ResolveTarget'` gives
`codes.test.ts(1002,7): error TS2741: Property 'writeStep' is missing`. The `as (value: unknown) =>
TranslationKey` cast at `:1071` reopens nothing: the argument it erases was checked against that
builder's own `Parameters<>[0]` where the table declares it.

**Claim 3 — `wire_contract.rs:3724`. Holds.** `ContentRevision`'s hand-written `Serialize`
(`watch/mod.rs:174`) writes a string, so `Some(rev)` on `Changed` is countable by the
`is_string() || is_number()` filter at `wire_contract.rs:4050` and `None` on `Removed` is not; the
`content` arm serialises as an object under either variant. Every sentence of the corrected doc is
true of the samples as they stand.

**`ExpectNever` — holds.** `ExpectNever<T extends never> = T` (`exhaustive.ts:59`); widening
`ReconciliationEventName` to `string` instantiates it with `'widened'`. Test files are inside
`tsconfig.json`'s `include`, so `npm run check` reads it. The `events.ts` permissions paragraph is
correct: both identifiers are in `desktop-schema.json:392,398`, `_unlisten` unregisters locally then
`await invoke('plugin:event|unlisten', …)`, and `UnlistenFn = () => void` is what makes "nothing
awaiting it" true rather than a guess about the caller.

### Findings

**M1 — `src/lib/browser/workspace.test.ts:446` and `:483`–`:490` — SOURCE.** The `afterEach` claims
`drains` "is what makes an unexpected call *visible*" for the proposition "nothing in `BrowserState`
drains at 2d-4b". It only makes visible a call routed through the **injected** surface.
`workspace.svelte.ts:48` imports `drainExternalChanges` as a module-level binding that is in scope
inside every `BrowserState` method. Measured: inserting
`void drainExternalChanges(0).catch(() => undefined);` as the first line of `open()`
(`workspace.svelte.ts:2174`) leaves the suite at **186 passed, 0 failed** — the exact silence the
fix round was commissioned to end, through the one route the file already has open. A correct
version either states the bound in the comment ("a drain through `commands.drainExternalChanges`",
not "in `BrowserState`") or removes the direct import from `workspace.svelte.ts` and builds
`REAL_COMMANDS` from an object whose only reference to the wrapper is the property. The other two
suites do not have this route today — no component imports the wrapper — but their comments carry the
same unbounded wording.

**L1 — `workspace.test.ts:484`, `DetailPane.test.ts:334`, `RestorePane.test.ts:752` — SOURCE.**
"The count is cleared before it is read" is the inverse of the code: `const drained = drains;`
reads, then `drains = 0;` clears, then `expect` asserts. The isolation property it argues for is
real (the reset precedes the throw); the sentence describing it is not. Say "cleared before it is
asserted".

**L2 — `docs/decisions/2d-4b-notes.md:339`–`341` — RECORD.** "254 failures … then reverted
byte-identically" does not name which route the probe used, and the two routes give 254 and 0. The
record should name the injected surface, so a later reader cannot take the figure as evidence that
any drain in `open()` is caught.

No High. Nothing found against a consult ruling on its face.

### Where this round is thin

1. **The M1 bypass was measured only for `workspace.svelte.ts` — *actionable*, and it names a
   correctness defect in a source comment, so §7.3 makes it a blocker unless fixed now.** I did not
   enumerate every module that could acquire a direct import later.
2. **The compile-time half was checked with `npx tsc`, not `svelte-check` — *recorded only*.** The
   `*.svelte` import errors tsc emits are artifacts of that substitution; `npm run check` was not
   re-run.
3. **`Object.hasOwn(en, produced)` proves one member per namespace — *recorded only*.** The suite
   says so; nothing here re-derives the per-variant coverage that `dictionary_contract.rs` owns.
4. **No Rust gate was run — *recorded only*.** The `wire_contract.rs` derivation is by reading
   `ContentRevision::serialize` and the operand filter, not by executing the test.
5. **Ninth consecutive Opus round, consult unreviewed — *recorded only*.** Unchanged by this round.
