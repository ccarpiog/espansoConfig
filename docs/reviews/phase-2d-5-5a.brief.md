# Review brief — Phase 2d-5-5a

**Repository:** `/Users/ccarpio/Developer/Utils/espansoConfig` (Tauri v2 + Svelte 5 + TypeScript
frontend over a Rust workspace). **Review the uncommitted working tree**, not `HEAD`.

**Write the review to `docs/reviews/phase-2d-5-5a.md`.** Time budget: **20 minutes.**

---

## 1. The phase, and its exact scope

Phase 2d-5-5a is the **first half** of step 5 of the design consult
`docs/reviews/phase-2d-5-design.md` ("external conflicts and save arbitration"). The orchestrator
split step 5 in two on 2026-09-21:

- **2d-5-5a — this phase:** the `ConflictSource` origin union, the memoized save source, the six
  conflict registrations re-keyed, and origin-switched reapply evidence. Binding rulings **21, 22,
  23 and 24** of `docs/decisions/2d-5-split-notes.md` §3.
- **2d-5-5b — NOT this phase:** same-revision coalescing, different-revision supersession, and the
  per-document in-flight-write barrier. Binding rulings **25, 26 and 27**.

**Do not report the absence of rulings 25, 26 or 27 as a finding.** They are deliberately out of
scope. Do report anything in this phase's code that would *block* them.

**Components: none.** No `.svelte` file may change, and none did. Drawing the new origin is 2d-6's.

## 2. What the phase claims to have built

Per `docs/decisions/2d-5-5a-notes.md` (read it — it is the phase record and is itself in scope):

- `ConflictSource` split into named arms `SaveConflictSource | ExternalChangeConflictSource`.
- `ConflictModel<T>` became `SaveConflictModel<T> | ExternalConflictModel<T>`, with `expected`,
  `found` and `changedAgain` **required on the save arm and absent from the external one** — no
  optional top-level fields, because those would let the two origins masquerade as one another.
- All six `rememberTheConflict` callers now pass `saveConflictSource(answer.value)`; `conflictOrigins`
  and the reapply authorization memo are both `WeakMap<ConflictSource, …>`.
- New: `describeExternalConflict`, `BrowserState.rememberExternalConflict`, and `reapplyEvidenceFor`
  — the origin switch with the `base_revision` / `disk_revision` gate.
- Three new `en`/`es` keys and the typed accessor `tExternalEvidenceRefusal`, placed in
  `src/lib/i18n/index.ts` rather than `codes.ts` (the phase argues `codes.ts` is the wire-enum
  registry asserted exactly by `codes.test.ts`; verify that argument rather than assuming it).

## 3. Changed files

```
src/lib/browser/conflictSource.ts        src/lib/browser/conflictSource.test.ts
src/lib/browser/saveOutcome.ts           src/lib/browser/saveOutcome.test.ts
src/lib/browser/reapply.ts               src/lib/browser/reapply.test.ts
src/lib/browser/workspace.svelte.ts      src/lib/browser/workspace.test.ts
src/lib/browser/editorSave.ts            src/lib/browser/recovery.ts
src/lib/browser/restore.ts               src/lib/browser/matchEditor.ts
src/lib/browser/matchMove.ts             src/lib/browser/matchCreation.ts
src/lib/browser/matchDeletion.ts         src/lib/browser/matchDuplication.ts
src/lib/browser/rawEditor.ts
src/lib/i18n/en.json  src/lib/i18n/es.json  src/lib/i18n/index.ts
docs/decisions/2d-5-5a-notes.md (new)
```

**Four paths in the tree are NOT this phase's and must be ignored entirely** — they are the user's
uncommitted window-reading instrument: `src-tauri/src/main.rs`, `src/main.ts` (modified) and
`src-tauri/src/probe.rs`, `src/probe.ts` (untracked). `PROGRESS.json` is the orchestrator's
in-flight marker and is also not under review.

## 4. Verification already run, by the orchestrator, on this tree

Every command run on its own, nothing concurrent with `cargo`:

| Command | Exit | Result |
|---|---|---|
| `cargo test --workspace -- --test-threads=1` | 0 | **1320**, 26 `test result` lines, none lacking `0 failed`, none lacking `0 filtered out` |
| `cargo clippy --workspace --all-targets -- -D warnings` | 0 | clean |
| `cargo fmt --check` | 0 | clean |
| `cargo tree -p espansoconfig-core \| rg tauri` | 1 | finds nothing |
| `npm run check` | 0 | **443 files, 0 errors, 0 warnings** |
| `npm test` | 0 | **2431 passed in 61 files** |
| `npm run build` | 0 | **189 modules** |

Bundle oracles both read: server-only markers **absent**, client-only markers **present (2)**.
Instrument pin re-checked at `5 insertions(+), 1 deletion(-)`. Rung `1320 / 443 / 2431 / 189`, up
**+16** vitest cases from 2d-5-4-G's `1320 / 443 / 2415 / 189`; the other three did not move because
no module was added (`conflictSource.ts` already existed) and no Rust changed.

**The gates are green — so do not spend the budget re-running them.** Spend it on what no gate can
catch.

## 5. What to attack, in priority order

1. **Does the union actually make the two origins un-maskable?** Ruling 21's whole point is that an
   optional top-level `expected` / `found` / `changedAgain` would let a save conflict and an external
   one masquerade as each other. Check that none survived, including through a widened accessor, an
   index signature, a `Partial<>`, or a cast.
2. **Ruling 22's memo — identity, and what happens without it.** A caller that builds a fresh
   wrapper instead of going through `saveConflictSource` installs nothing, which fails safe but
   *silently*. Are all six registration sites really going through it? Re-derive all six by reading;
   the consult's line numbers (`:2546`, `:2638`, `:2715`, `:2775`, `:2898`, `:2980`) have drifted
   before. Does the `WeakMap` re-key leave any lookup still keyed on the old `ConflictResult`?
3. **Ruling 23's invariants.** `adoptDiskVersion` must remain the **only** confirmed-install door,
   with `installed | alreadyThere | refused` intact for an external-origin model too;
   `conflictChoicesFor` must remain the **only** producer of a choice list. Look for a second door
   or a second producer introduced by `rememberExternalConflict` or `describeExternalConflict`.
4. **Ruling 24's pairing gate.** External evidence is usable only when `base_revision` equals the
   retained draft's base **and** `disk_revision` equals the current disk snapshot. TypeScript cannot
   express that pairing. Is the gate a real conjunction, on the right two values, read from the right
   two places — and is it reachable on every path that consumes external evidence, or only on one?
5. **Check-and-spend.** This project has shipped this defect before: a check and a spend separated by
   **any property read** are not atomic, because a property read runs arbitrary code through a getter
   or a `Proxy` trap and `readonly` does not freeze at runtime. Also flag any consuming operation
   whose result is discarded (`set.delete(x)` with the boolean thrown away).
6. **Comments and the record that claim more than the code gives.** This project's stated worst
   defect class is a record or comment asserting a guarantee the code does not force. Every sentence
   in `docs/decisions/2d-5-5a-notes.md` and every new source comment is in scope: check each
   `file:line` citation resolves to what it claims on **this** tree, and check each "this forces X"
   clause against what the type system actually forces.
7. **i18n.** Three new keys in `en.json` and `es.json`, one typed accessor. Verify key parity,
   placeholder agreement, that no component builds a key by hand, and that the external conflict's
   sentence **claims only an open write surface and never a dirty draft** (ruling 19 — the
   coordinator cannot observe `isDirty`).
8. **The two deviations the phase reports, in §5 and §8 of the notes.** `SaveOutcomeModel`'s conflict
   arm is `SaveConflictModel`, not the union; `beginReapply` takes `SaveConflictModel<T> | null`, so
   an external conflict is refused by the compiler. The phase argues both are truthful today and
   deliberately push work to 2d-6. Is that argument sound, or does it leave the external origin
   unreachable in a way the new tests only appear to cover?
9. **Do the new tests pin behaviour, or restate the implementation?** +16 cases. A test that would
   still pass with the behaviour removed pins nothing. Say which of the new cases are load-bearing.

## 6. Project rules a finding may rest on

- `CLAUDE.md` at the root is binding. §2 (i18n, both languages, typed accessors), §3 (the core crate
  never depends on `tauri`; the file on disk is the source of truth), §5 (JSDoc on every function; a
  closing-bracket comment over 10 lines; English everywhere), §6 (the invariant list — the
  "Writing files", "Text on the wire and on screen" and "Frontend structure" blocks all bear here).
- **A green suite is not a screen**; no claim about what a window draws is in scope for this phase.
- **Never quote the owner's real espanso config content** in the review. File names, counts and line
  numbers are fine; content is not.

## 7. The verdict line

End the review file with one of `ship`, `ship-with-fixes` or `do-not-ship`, and a numbered blocker
list. A **blocker** is a correctness defect in source, or a record sentence that is false on this
tree. Anything else is SHOULD-FIX or recorded-only. Be specific: name the file, the line as it
stands on this tree, and the concrete failing scenario.
