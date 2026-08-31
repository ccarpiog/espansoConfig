Reviewer: autoclaude adversarial reviewer

# Phase 2d-5 design consult — adversarial record review

## Blockers

None. Documents only; `git status --short --untracked-files=all` lists exactly the three files, all
under `docs/`, and no source file exists to break.

## Should-fix

1. **`2d-5-split-notes.md:462-466` asserts a fact that is false in this same commit.** §5.5: *"The
   preamble of `docs/reviews/phase-2d-5-design.md` says **sixteen**"* — that preamble
   (`phase-2d-5-design.md:11`) says **fifteen**, agreeing with `PROGRESS.md:240-241`. The recorded
   discrepancy no longer exists, so *"the two counts differ by one"* and *"this record does not
   adjudicate it"* both misdescribe the repository. The correction landed; the record of it did not.

2. **The 67-row citation table's `Consult line` column is off by one in every row**
   (`2d-5-split-notes.md:324-392`). Re-derived: row 1 says 45, the citations are on 46; row 19 says
   120, actual 121; rows 31-38 say 195, `rg` puts the five abbreviated `:NNN` on **196**; row 65 says
   285, actual 286; rows 66-67 say 350, actual 351. Same root cause as finding 1 — the header
   correction added a line after the audit was derived, and the locators were not re-derived. **The
   `file:line` verdicts themselves survive**: I opened 20+ rows adversarially (1, 2, 3, 5, 6, 7, 10,
   14, 15, 16, 17, 22, 23, 25, 29, 30, 31-36, 41, 42, 48, 51, 53, 54, 56, 59, 60, 62, 63, 64, 65, 66,
   67) and every one resolves, including all three flagged rows.

3. **`2d-5-split-notes.md:144-146` (§3 entry 4) cites the wrong lines for its own claim.**
   `restore.ts:378-383` is the `OpenWriteSurface` interface (`kind` + required `document`); the reason
   a creator with no destination competes with no restore is the doc paragraph at `restore.ts:373-376`
   — which is what the consult cited (row 6, `:363-376`).

4. **`2d-5-split-notes.md:225` turns permission into obligation.** The consult
   (`phase-2d-5-design.md:170`) says the raw viewer *"may* refresh automatically"; entry 20 says it
   *"refreshes automatically"*.

5. **"said so in its own third paragraph"** (`phase-2d-5-design.md:23`, `2d-5-split-notes.md:25`). The
   no-gate sentence is the reply's **second** prose paragraph (raw line 5), true only if the `VERDICT`
   heading counts as one.

## Checked and clean

- **Verbatim reproduction.** `diff` of the raw reply (`task-mthcaa8p-yrnx03`, 329 lines) against
  `sed -n '28,356p' phase-2d-5-design.md` returns exactly two hunks: `## VERDICT` → `###`, and the
  dropped `Resume in Codex:` trailer with the session ID retained. Byte-faithful otherwise.
- **Counts re-derived, not trusted.** 56 named `file:line` + 11 abbreviated `:NNN` = **67**, exact.
  186 = 180 `\bit\(` matches + 6 `WRITERS` rows, exact. `invoked` sites: 5 in `RestorePane.test.ts`
  (808/911/941/968/1084), 1 in `DetailPane.test.ts` (534), neither in an `afterEach` — exact.
  `workspace.test.ts` `drains` at 319/472, `afterEach` 502-513 — exact. §5.3's re-derived
  `DetailPane.svelte` endpoints (472, 494, 664-672) are correct, and `:649-665` does stop at the first
  of seven conditions.
- **Binding rules.** No second install door, no second choice-list producer, no writer beside
  `save_document`, no `force`; entry 23 restates both monopolies; §6 item 6 books the EN/ES + accessor
  debt; nothing proposes core→tauri; D2r/R25/D2u untouched.
- **Corpus privacy.** `rg` for config-content shapes across all three files: no matches.
- **§7.3 marks.** Item 1's *actionable* is right by the rule — it names a check runnable in files that
  exist. Nothing it names is wrong in source today, so *"none is a blocker"* holds.

## Not verified

- Every gate figure (1320 / 434 / 2175 / 184, both bundle oracles): forbidden by the brief; taken from
  the orchestrator's table, not re-run.
- ~35 audit rows I did not open individually, and no row's *characterisation* beyond its endpoints.
- Whether the consult's design rulings are good design. No window, no suite, no build was run here.
