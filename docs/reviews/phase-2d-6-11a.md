Reviewer: autoclaude adversarial reviewer

# Phase 2d-6-11a — adversarial review

## BLOCKERS

None found.

## SHOULD-FIX

1. **Mounted-suite discovery does not follow Vitest's rule, so a new suite can get past it (risk 1, entry 37 "every discovered mounted suite").**
   - `scripts/lint/composition-guards.ts` `declaredEnvironment` reads only a *leading* block comment: `/^\s*\/\*\*?([\s\S]*?)\*\//`. It matches only `@vitest-environment`.
   - Vitest 4 (`node_modules/vitest/dist/chunks/cli-api.BK8pd4xc.js:100`) takes the first match anywhere in the file: `content.match(/@(?:vitest|jest)-environment\s+([\w-]+)\b/)`.
   - Three kinds of file therefore run in jsdom while the checker reports `null`, never inventories them and never checks their guard:
     - a new `*.test.ts` that starts with `// @vitest-environment jsdom`;
     - one that uses `/** @jest-environment jsdom */`;
     - one that puts the docblock after an import or a licence comment.
   - That is the "new-file residue" entry 37 exists to close.
   - Fix: apply Vitest's own regex to the whole text, and pin a case for each of the three forms.
2. **A comment claims something the test file itself disproves (the worst defect class, per CLAUDE.md §5).**
   - `composition-guards.ts`, the `declaredEnvironment` JSDoc, says: "Vitest reads `@vitest-environment` from a leading docblock; this reads the same tag".
   - `composition-guards.test.ts`, the `JSDOM_DOCBLOCK` doc, says: "Vitest reads `@vitest-environment` from anywhere in a test file's comments and literals".
   - The first is false, and "the same tag" hides finding 1.
   - The phase notes (§1.1, "whose leading docblock names…") describe the mechanism accurately. They do not state the gap under "What this check is not" or under open item 3.

## NITS

- `composition-guards.ts` `scanBoundaryImports`: a template-literal dynamic import, ``import(`../ipc/commands`)``, is literal but not reported. The dynamic-import alternative accepts only `'`/`"`. The header claims every "literal dynamic import".
- `composition-guards.test.ts`, the `MOUNTED_SUITES` entry for DetailPane, still gives the reason "drains counted separately". Drains are now exact argument lists.

## Risks probed with no finding

- **Risk 2.** `AppShell.test.ts` has only additions (`git diff --unified=0` shows no removed line). Its new cases push onto `expectedInvokes`, and the file's `afterEach` checks that list exactly.
  - In `DetailPane.test.ts`, `expect(drained).toEqual(expected)` replaces the count, and `invoked` stays `not.toHaveBeenCalled()`.
  - The seven newly guarded suites each carry the rejecting spy, and the checker accepts it.
- **Risk 5.** The recorded defect matches the code.
  - The `writtenHere` arm (`workspace.svelte.ts` ~4634) deletes the retained reading and delivers, but does not clear the status.
  - `markStaleWhileOurs` is at `observationTransitions.ts` ~1202.
  - The 7(b) case asserts no `stale` either way, and says so in a comment.
- **Risk 4.** The new `ReconciliationStatus` cases compare against the other locale and assert `not.toContain`, so they are not a `translate` compared with itself. The bounded-retry case checks through `expect(reenter).toBe(false)` that the re-entrant press really fired. The automatic-recovery case in `AppShell` is bounded by the exact invoke list.
- **Composition-root allowance.** It is checked three ways (the file exists, it really imports the boundary, the entry has a reason). The negative fixtures cover the forms that matter.

## NOT-VERIFIED

- I did not rerun the whole of `npm test`, `npm run check` or `npm run build`. Only `composition-guards.test.ts` was run: 65 passed.
- I did not re-audit, row by row, the claim that the matrix is complete. The notes disclose that row 8(d) and the save-origin loops are EN-only.
