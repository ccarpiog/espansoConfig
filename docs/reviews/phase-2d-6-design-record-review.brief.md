# Review brief — the 2d-6 design consult's record (phase `2d-6-design`)

- **Repo path:** `/Users/ccarpio/Developer/Utils/espansoConfig`, branch `main`.
- **Phase and goal:** `2d-6-design` — Phase 2d-6 (components, i18n and mounted evidence) put to a design
  consult before any line of it is written, per the project's standing rule since 2b-2c. The phase's
  product is three documents: the brief, the Codex consult, and the binding record with its split,
  rulings and citation audit. **A consult touches no source**, and this one did not.
- **Changed files (all uncommitted, all new, all under `docs/`):**
  - `docs/decisions/2d-6-design-brief.md` — the brief (278 lines; 16-row facts table, eleven questions).
  - `docs/reviews/phase-2d-6-design.md` — the consult: an orchestrator header, then Codex's reply verbatim
    from the `---` line on (job `task-mub3r0qh-b6gfi9`, high effort, ~19 min).
  - `docs/decisions/2d-6-split-notes.md` — the record (770 lines): §2 the eleven-step split, §3 forty-three
    binding rulings, §4 a 114-row citation audit, §5 nine corrections to earlier documents, §6 what was
    not settled, §7 the open-item map, §8 a placeholder for this review.
  - Not part of this phase and never to be touched: the four instrument paths `src-tauri/src/main.rs`,
    `src/main.ts`, `src-tauri/src/probe.rs`, `src/probe.ts`, and the in-flight `PROGRESS.json` edit.
- **Verification run:** `git status --short --untracked-files=all` shows no source path beyond the four
  instrument paths; `npm test` exit 0, 2474 tests in 62 files (unchanged rung). No Cargo gate was run
  because no Rust or TypeScript file changed. **Do not run `cargo` or `npm` yourself** — read only.
- **What to review, adversarially:**
  1. **The record against the consult.** Does every §3 ruling say what the consult said — neither a
     permission promoted to an obligation nor an obligation softened to a permission? Does any ruling
     claim a compile-time or runtime guarantee the cited code does not give (this project's worst defect
     class, `CLAUDE.md` §5 last bullet)? Sample at least fifteen rulings against the consult's text.
  2. **The citation audit.** Open at least twenty of the 114 rows on the current tree, favouring the nine
     marked *resolves with a note* and any row whose characterisation looks stronger than a line range
     can carry. Verify the *consult line* column on a sample with `rg -n -F` against
     `docs/reviews/phase-2d-6-design.md`.
  3. **The corrections (§5).** Is each one really an override of an earlier document, quoted fairly, and
     is the reason the ruling wins stated? Is any override the consult made missing from §5?
  4. **The split (§2) against Q11 of the consult.** Does each step carry the rulings the consult assigned
     it, are the recorded gaps and overlaps of §6 real, and is any gap unrecorded?
  5. **The brief's facts table (§3 of the brief)** — spot-check five rows; a wrong fact fed to the
     consultant taints the ruling built on it.
  6. **Privacy:** no real-config content quoted anywhere (`CLAUDE.md` §1). File names and counts are fine.
- **Risks the orchestrator sees:** the record is 770 lines against a 450-650 target — density, not
  padding, is the claim; the consult relies on a brief written the same morning, so a shared blind spot
  would not show up as disagreement; the audit's *consult line* column is exactly where the 2d-5 record's
  review found an off-by-one in all 67 rows.
- **Review file:** write the full report to `docs/reviews/phase-2d-6-design-record-review.md`, first line
  naming the reviewer. Verdict vocabulary: `ship`, `ship-with-fixes`, `do-not-ship`; list `BLOCKERS`
  and `SHOULD-FIX` separately, each with file, line and the evidence you derived.
- **Time budget:** 12 minutes.
