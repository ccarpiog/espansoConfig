# Phase 2d-6-11a — the cross-surface matrix, exact drain scripts and the inventory check

**Date:** 2026-09-23.
**Spec:** [`2d-6-split-notes.md`](2d-6-split-notes.md) §2, the *2d-6-11* block and the
orchestrator's cut of it into 11a and 11b, recorded under that block in this phase. Bound by §3
entries 34 (the matrix), 36 (drains and `invoked`), 37 (the architectural check) and 41 (comments a
diff falsifies). Entry 42's baselines are 11b's.
**Components:** none. **No production source, no Rust, no string, no instrument path changed.**
Every change is a test file, the new lint pair under `scripts/lint/`, or a record.

---

## 1. What changed

### 1.1 The architectural check (entry 37)

`scripts/lint/composition-guards.ts` (the checker) and `scripts/lint/composition-guards.test.ts`
(the inventories and the pinning cases, 65 tests).

- **Imports.** Every `.svelte` and non-test `.ts` file under `src/lib/components/`, plus
  `src/App.svelte`, is scanned. A finding is a value import, `export … from`, side-effect import or
  literal dynamic `import()` of a boundary module (`src/lib/ipc/{commands,events,menu,index}`, the
  `src/lib/ipc` barrel, anything under `@tauri-apps/`), or of `REAL_COMMANDS`,
  `REAL_BACKUP_COMMANDS` or `createBrowserState` from `workspace.svelte.ts`. Type-only imports are
  not findings. `AppShell.svelte` is the one allowed composition root. The allowance is checked in
  three directions: the file exists, it really imports the boundary, and the entry has a reason.
- **Guards.** Every test file under `src/` and `scripts/` whose leading docblock names a
  non-`node` environment must be in the inventory. Its text must carry the guard it is listed with:
  - `invokeZero`: a `vi.mock('@tauri-apps/api/core', …)` recording spy, and an `afterEach` that reads
    the spy and asserts zero;
  - `invokeExactList`: the same mock, and an `afterEach` that compares a list (`AppShell.test.ts`);
  - `mountsNothing`: no `mount`, no component import and no boundary import (`reveal.test.ts`).
  Stale inventory entries fail.
- **Pinned to fail.** Synthetic inputs are reported:
  - an unguarded jsdom suite that is not inventoried (the entry-37 fixture);
  - a suite claiming a guard it does not carry;
  - a spy that no `afterEach` reads;
  - a relaxed non-zero assertion;
  - a mock written only in a comment;
  - a "mounts nothing" suite that mounts;
  - a synthetic `import { saveMatch } from '../ipc/commands'` in a component, plus ten variants
    (namespace, barrel, `$lib`, events, `REAL_COMMANDS`, the factory, dynamic, re-export,
    side-effect, the Tauri package).
  Type-only imports, `ipc/errors`, comments and markup stay quiet.
- **Limits, in the code and here.** A static import check is not proof against dynamic execution.
  A command reached **transitively** through a browser module is not reported, and neither is a
  specifier computed at run time. Both are pinned as accepted blind spots. The guard half proves only
  that the text carries the guard. It does not prove that the assertion is the right one, or that
  every case runs under it.
- **The check found real gaps before it passed.** Its first run on the real tree failed on seven
  unguarded mounted suites: `MatchEditor`, `MatchCreator`, `MatchDeleter`, `MatchMover`,
  `MatchDuplicator`, `RawEditor` and `RecoveryPanel`. Each now carries the hoisted rejecting
  `invoked` spy and a file-level `afterEach` holding it to zero. No existing case changed, and no
  suite had a real `invoke` call. That first run is the negative control for the guard half, on real
  files.
- **A Vitest detail found on the way.** Vitest reads the `@vitest-environment` tag out of a test
  file's literals, not only its leading docblock. A literal fixture switched the checker's own suite
  into jsdom, which broke `import.meta.url`. The fixture now assembles the tag at run time, and a
  comment in the file says why.

### 1.2 Finite drain scripts with exact counts and arguments (entry 36)

In `DetailPane.test.ts`, the 2d-6-6b count (`drains` / `expectedDrains`) is replaced by the exact
ordered `afterSequence` list. The stub records each argument. Each reconciliation case declares
`expectedDrainArguments`, and the `afterEach` compares the two with `toEqual`. That comparison fixes
the count and every argument. An empty list means exactly zero drains, which is what every case that
starts no reconciliation still gets. `invoked` stays exact zero.

- All 22 existing counting cases were converted. Three drains give `[0,0,0]`, four give
  `[0,0,0,5]`, and the viewer case gives `[0,0,0,5,6]`. Each was traced from the coordinator's
  watermark and then confirmed by running.
- Every new case declares its list too.
- Every case's batch queue is finite and exactly as long as its list.
- `AppShell.test.ts`'s existing cases, helpers, `expectedInvokes` and file-wide `afterEach` are
  untouched. Its three new cases follow the existing per-case list mechanism.

### 1.3 The cross-surface matrix completed (entry 34, Q8)

Four read-only audits mapped every sub-clause of the nine rows to a case or a gap. The gaps were then
closed:

| Row | Gaps closed (new cases) | File, tests before → after |
|---|---|---|
| 1 `DetailPane`: kinds, delivery, pristine, sentinels, no automatic reload | pristine raw editor and restore conflict (EN/ES); drafted editor, creator, mover position and recovery form keep their draft through a delivery; read counts and file revision unchanged across the wake (also added to the same-file host+recovery case) | `DetailPane.test.ts` 72 → 85 |
| 2 `DetailPane`: unknown creator, recovery over B, same file | unknown target still unknown, both files still live, create disabled, nothing chosen between the wake and the click (assertions added to the existing case) | (same file) |
| 3 `DetailPane`: raw refresh, raw conflict, close/reopen | reopened creator and reopened recovery form get no old delivery | (same file) |
| 4 each surface: cannot submit, every choice, supersession, three adoption outcomes | external-conflict blocks for the editor and the creator (every choice, `installed`/`alreadyThere`/`refused`, supersession, EN/ES); the same for the recovery form | `MatchEditor.test.ts` 56 → 74; `MatchCreator.test.ts` 47 → 67; `RecoveryPanel.test.ts` 28 → 46 |
| 5 `RestorePane` | none: already complete | — |
| 6 `RecoveryPanel`: source identity, destination report, authored fields, blocks creation | covered by row 4's block, plus a bilingual sibling of the EN-only destination case | (above) |
| 7 workspace/coordinator + mounted integration | mounted through a real wake: a reading held behind a committed raw save, same revision → `writtenHere`, different revision → `raised`; a raw save that may have written → `raisedWithoutReload`; retry boundedness (two presses in one turn plus a re-entrant press spend one attempt) | `DetailPane.test.ts` (above); `ReconciliationStatus.test.ts` 34 → 40 |
| 8 `AppShell` | lost-history recovery through the production composition: held by an open surface, then pressed (EN/ES), and automatic with no surface open | `AppShell.test.ts` 14 → 17 |
| 9 sidebar/status | locale switch over a stale file and over an unavailable file changes the words and nothing else (both directions) | `ReconciliationStatus.test.ts` (above) |

**What "complete" covers.** Every sub-clause of the nine Q8 rows now has at least one mounted case
over the real registry and coordinator where the row asks for one, and a surface-suite case where it
asks for that. Row 5 and most of rows 1-3, 7, 8 and 9 were already covered by 2d-6-6 … 2d-6-10.
`MatchDeleter`, `MatchMover`, `MatchDuplicator`, `RawEditor` and `RestorePane` already met row 4.

**What it does not cover.**
- It is mounted evidence in jsdom, not a window reading. There is no new window claim.
- It does not satisfy entry 35's reviewed literal EN/ES fixtures: the new bilingual cases compare
  against `translate(lang, …)`, not reviewed literals. That is 11b's.
- Not every pre-existing EN-only case was parameterized. In particular `AppShell`'s last-document
  removal case (row 8(d)) is still EN-only.
- The audit mapped clauses to cases. It did not re-review the assertions of the cases that already
  existed.

## 2. Comments this diff falsified (entry 41, scoped)

- `DetailPane.test.ts`: the docs of the drain list, the stub and the `afterEach`, and six suite
  comments that said "counted exactly" or named `expectedDrains`. They now describe the argument
  list.
- `RestorePane.test.ts`: the guard comment said nothing in Vitest prevents a future file importing
  commands with no spy. It now names the new check, and that a `node`-environment file is still
  outside it.
- `2d-6-split-notes.md` §7: the check "does not exist yet". A dated correction passage was added, and
  the sentence is kept.

No production comment was falsified, because no production file changed.

## 3. Acceptance, clause by clause

| Clause | Status |
|---|---|
| Cross-surface matrix complete per the record; notes say what "complete" covers and does not | **Met.** §1.3 |
| `DetailPane` reconciliation-starting cases have finite drain scripts with exact counts | **Met, and stronger:** exact ordered arguments (§1.2) |
| `invoked` exact zero preserved in injected suites | **Met.** Unchanged in the four suites that had it; added to seven more |
| `AppShell.test.ts` per-case list untouched | **Met.** Additions only (§1.2) |
| Architectural check exists and passes on the real tree | **Met.** 65 tests pass |
| It fails on an unguarded synthetic fixture and on a synthetic direct command import | **Met.** §1.1, plus the real-tree negative control |
| Its comments say a static import check is not proof against dynamic execution | **Met.** In both files' headers |
| Components none; no Rust | **Met** |
| Split recorded in the split notes | **Met.** Passage under the 2d-6-11 block |

## 4. Verification

Each command was run on its own, with its output redirected to a file and then grepped:

- `npm test` exit 0: **3525** tests in 71 files, up from 3382 by +143. Per file:
  - `composition-guards.test.ts` +65 (new);
  - `MatchCreator` +20;
  - `MatchEditor` +18;
  - `RecoveryPanel` +18;
  - `DetailPane` +13;
  - `ReconciliationStatus` +6;
  - `AppShell` +3.
- `npm run check` exit 0: **461** files, 0 errors, 0 warnings. The +2 are the lint pair, which
  `tsconfig.json` includes.
- `npm run build` exit 0: **201** modules. No module was added, because every new file is test or
  lint code.
- The server-only markers are absent from `dist/assets/`. The client-only markers are present (2 in
  `index-*.js`).
- `git diff --stat src-tauri/src/main.rs src/main.ts` still shows `5 insertions(+), 1 deletion(-)`.
- No Rust was touched, so the Rust count carries over.

**Rung: `1323 / 461 / 3525 / 201`**, with the instrument in the tree (previous
`1323 / 459 / 3382 / 201`).

## 5. Open items

1. **A `stale` mark survives a `writtenHere` release.**
   - What happens: a reading that arrives while the raw editor is open marks the file stale
     (`markStaleWhileOurs`, `src/lib/browser/observationTransitions.ts` ~1203). The `writtenHere`
     branch of the release (`src/lib/browser/workspace.svelte.ts` ~4634-4645) then drops the reading
     without clearing that mark. The pane keeps saying the file is not reconciled, although the
     window holds the bytes the watcher read.
   - Why the ruling is unclear: the `stale` definition allows the mark while a write surface is
     open.
   - What the phase did: the new 7(b) case pins no `stale` assertion. A comment in the case says the
     question is open.
   - Owner: this needs a ruling, and the owning step is 2d-6-9b-1's area (a small corrective step).
   - This joins 9b-3's item 1 (a hold with a successful re-adoption leaves a file `stale` with nothing
     to acknowledge).
2. **For 11b.**
   - Reviewed literal EN/ES fixtures for the safety-critical sentences, including those the new
     bilingual cases read through `translate`.
   - The entry-41 sweep (e.g. "Nothing in this file calls it" on `drainExternalChanges`).
   - The four baselines, with the instrument and normalized, against `1320 / 438 / 2254 / 186`.
   - The consolidation of the narrow readings.
3. **The check does not cover these, stated and not fixed:**
   - `node`-environment test files importing commands with no spy;
   - transitive command reach through browser modules;
   - computed specifiers.
4. **Not done.**
   - `AppShell`'s last-document-removal case (row 8(d)) is EN-only.
   - The pre-existing EN-only save-origin adoption loops in `MatchEditor` and `MatchCreator` stayed
     EN-only.

## 6. Deviations

- The four test-writing passes ran as parallel subagents on disjoint files. The orchestrator of this
  phase ran the gates once, after all four had finished.
- Two surface-suite helpers were widened additively:
  - `deliver` in `mountEditor` and `mountCreator` now sets the stand-in `standingConflictFor` for a
    raised or superseding delivery, as `mountDeleter` already did. Without it, every *Keep my draft*
    is refused as superseded evidence.
  - `RecoveryPanel`'s `opened`/`seenChange` moved to module level, with a `stand` hook.
  - `DetailPane`'s `PaneScript` gained an optional `rawSaveGate`.
  Existing callers behave as before, and every existing case passes unchanged.

## 7. The review and its fix

Codex was out of quota (`autoclaude-review.sh` exit 2, `REASON=usage-limit`); the fallback agent
`autoclaude-reviewer` (opus) wrote [`docs/reviews/phase-2d-6-11a.md`](../reviews/phase-2d-6-11a.md):
**`ship-with-fixes`, 0 BLOCKERS, 2 SHOULD-FIX**, both about one defect. `declaredEnvironment` in
`scripts/lint/composition-guards.ts` read only the first block comment and only the `@vitest-` spelling,
while Vitest 4 matches `/@(?:vitest|jest)-environment\s+([\w-]+)\b/` anywhere in the file, so a suite
opting into jsdom through a line comment, the `@jest-` spelling or a tag after an import ran mounted
without being inventoried; and its JSDoc claimed it read "the same tag" Vitest reads. **Fixed by the
orchestrator:** the function now applies Vitest's own pattern to the whole file text, and its JSDoc says
it is a copy of that pattern, not a call into Vitest, so a later change to Vitest's pattern is not
tracked. One case in `composition-guards.test.ts` pins the three placements and the untagged file.
The real tree's inventory is unchanged by the fix (the suite passes with the same entries).

After the fix: `npm test` exit 0, **3526** passed (71 files, +1); `npm run check` exit 0, 461 files,
0/0. No rebuild: `scripts/lint/` is not reachable from the bundle, so the module count stays 201.
