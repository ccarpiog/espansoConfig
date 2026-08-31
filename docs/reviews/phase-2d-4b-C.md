Reviewer: autoclaude adversarial reviewer

# Phase 2d-4b-C — review of 2d-4b-B's fix

### Scope

Commit `1c34579`, source half only: six comment blocks in `src/lib/browser/workspace.test.ts`,
`src/lib/components/DetailPane.test.ts` and `src/lib/components/RestorePane.test.ts`. No
executable line changed. Record halves (`PROGRESS.md`, `docs/`) are in scope only as RECORD
findings. Gates were not re-run (orchestrator owns them; `cargo` and full `npm test` forbidden);
one permitted single-file run was made.

### Derivations

1. **The escaping route is stated correctly.** `workspace.svelte.ts:48` imports
   `drainExternalChanges` at module level; `REAL_COMMANDS` at `:315-329` has thirteen members, all
   module-level bindings, so "uniform across all thirteen" holds. `createBrowserState`
   (`:1507`) takes `commands` as a parameter, so both routes exist.
2. **"186 passed, 0 failed" is attributed to 2d-4b-B, not claimed as this author's.**
   `npx vitest run src/lib/browser/workspace.test.ts` → **186 passed**, so the figure is live and
   the sentence is honest.
3. **No `.svelte` component imports the wrapper** (`rg -n drainExternalChanges src/`), so the
   literal clause is true of components — but see M2 for what it omits.
4. **The `afterEach` indirection resolves**: `DetailPane.test.ts:339` and
   `RestorePane.test.ts:756` point at their own count doc comments, which are bounded — but those
   doc comments carry M2.

### Findings

**M1 — Medium, source. `src/lib/browser/workspace.test.ts:314`.** The `drains` doc comment still
reads *"**no case in it may drain**, whichever surface it built and however many"* — the exact
unbounded claim the fix was commissioned to remove, surviving in the one file whose subject module
*is* the escaping route. The fix bounded this file's stub comment (`:444`) and `afterEach`
(`:496`) and bounded the equivalent doc comment in **both** component suites (`DetailPane.test.ts:159`,
`RestorePane.test.ts:434`), skipping only this one. This is `CLAUDE.md`'s named
"narrower instance still standing" shape. Correct version: *"no case in it may drain **through the
injected surface**, whichever surface it built and however many; the bound and the route that
escapes it are stated where the count is incremented."*

**M2 — Medium, source. `src/lib/components/DetailPane.test.ts:160-162` and
`src/lib/components/RestorePane.test.ts:435-437`.** Both say a drain by *"any other route — a
module-level import of `drainExternalChanges`, **which no component has today*** — increments
nothing here. The parenthetical asserts the exemplified route is **absent**, while both suites
mount over a **real** `BrowserState` (`DetailPane.test.ts:279`, `RestorePane.test.ts:538`, whose
own doc says *"Mounts the pane over a real `BrowserState`"*) built by `workspace.svelte.ts`, which
holds precisely that module-level import at `:48`. So the route named as non-existent is live in
these two suites — through the module under the pane, not through the component — and neither
comment names it. Nor do they name the file's actual partial defence: the rejecting `invoke` mock
(`DetailPane.test.ts:66-71`, `RestorePane.test.ts:117-123`) with `invoked` cleared in `beforeEach`
(`:331`, `:749`) and asserted only in single cases (`:528`; `:802, 905, 935, 962, 1078`), never in
`afterEach` — so it is not a file-wide guard. Correct version: name `workspace.svelte.ts`'s
module-level import as the route that **is** open in these suites, exactly as `workspace.test.ts`
does, and keep *"no component imports the wrapper"* as the separate, narrower fact it is.

**L1 — Low, source. `src/lib/browser/workspace.test.ts:452-453`.** *"`workspace.svelte.ts` imports
every command wrapper at module level to build `REAL_COMMANDS`"*. Sixteen wrappers are imported
(`workspace.svelte.ts:44-60`); three of them — `listBackupBatches`, `listBackupEntries`,
`readBackupText` — build `REAL_BACKUP_COMMANDS` (`:387-391`), not `REAL_COMMANDS`. Harmless to the
drain bound, false as written. Correct version: *"imports all sixteen command wrappers at module
level, thirteen of which build `REAL_COMMANDS`"*.

**L2 — Low, RECORD. `docs/decisions/2d-4b-notes.md:458-459` and `:461-462`.** Two claims. (a)
*"bounds all six sentences (two in `workspace.test.ts`, two in `DetailPane.test.ts`, two in
`RestorePane.test.ts`)"* — the diff bounded **eight** comment blocks, two plus three plus three,
and the "all six" framing is what hides the seventh sentence M1 names. (b) *"The two component
suites have no such route today — no component imports the wrapper — and their comments say that
rather than implying it"* is the record half of M2: no component imports it, and the route is open
anyway through the real `BrowserState` both suites build. Correct version: state the count as
eight, and say the component suites have no *component-level* route while the
`workspace.svelte.ts` route reaches them through `createBrowserState`.

No High. Nothing in this diff changes behaviour; every finding is a comment or record claim that
is wider than what is true, which is the class 2d-4b-B itself was answering.

### Where this round is thin

- **actionable** — M1, M2 and L1 are correctness defects in **source** comments, so per §7.3 they
  are fixed now or the step is `BLOCKED`. Their fix will change source and so commissions 2d-4b-D
  under §7.1 (subject to §7.4's cap).
- **actionable** — the two component suites' `invoked` spy is asserted per-case, never in
  `afterEach`. Moving `expect(invoked).not.toHaveBeenCalled()` into each `afterEach` would close
  the module-binding route in those two files at the cost of one line each. Not a defect; a
  closure 2d-5 may adopt beside the two already declined in §8.2.
- **recorded only** — no gate was re-run here beyond one single-file vitest; the orchestrator's
  table is taken as given.
- **recorded only** — eleventh consecutive Opus round, no second provider; a shared blind spot
  across the tail would not be visible from inside it.
- **recorded only** — I did not re-derive `MatchDeleter.test.ts:954`, `MatchMover.test.ts:1209,
  1308` or `MatchDuplicator.test.ts:1112`, which stub the drain without counting it. They are
  outside this diff and make no claim about draining, so they carry no overclaim — but they are
  also not covered by any drain guard.

### Tree

No file was mutated to verify any claim. `git status --short` was empty before this report and
this file is the only write.
