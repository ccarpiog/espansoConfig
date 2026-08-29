# Phase M2 — the review-tail termination rule (2026-08-29)

_Moved out of `PROGRESS.md` when that file passed its 400-line soft budget, on the iteration that
closed 2d-4a rounds 7 and 8. Verbatim; nothing is summarised away._

### Phase M2 — the review-tail termination rule (2026-08-29)

**Reviews: 2/2, both Codex at high effort, both `not-ready`, every finding fixed.** The full text of
both rounds is [`docs/reviews/phase-M2-review-tail-termination.md`](docs/reviews/phase-M2-review-tail-termination.md).

- **Round 1** — 2 High, 2 Medium, 1 Low. Its Highs were real: the first draft counted rounds with two
  independent rules, one commissioning and one closing, and they disagreed on three verdict shapes —
  in one of which a step closed while a source-changing fix went unreviewed. Its second High showed
  the definition of "source" excluded `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`,
  `vite.config.ts`, `package.json`, `scripts/` and the lockfiles, all of which change behaviour. The
  fix replaced the mechanism with a single generator and **inverted** the definition so the closed
  list is the record and everything else is source, which fails safe.
- **Round 2** — 1 High, 1 Medium, 3 Low, and one clearance: it confirmed round 1's second High closed,
  finding no remaining ambiguity in the closed list. Its High was an overclaim — the section said
  flatly that the rule terminates, which is false where every fix keeps introducing a real source
  defect — and an unaccounted residue: a source fix the workflow's two-invocation cap leaves
  unreviewed. Both fixed, the second by saying the debt becomes a corrective phase. Its Medium closed
  the last hole: an actionable item naming a source defect is now a blocker, never something a later
  phase may decline to adopt.
- **No third round ran, and none was owed.** The governing workflow caps a phase at two review
  invocations. Independently, under the rule this phase installed, the fix round changed only record
  files, so §7.1 commissions nothing — the rule's first application agreed with the cap.

**This phase changed no source file**, which `git diff --stat HEAD` shows directly: `CLAUDE.md` and
`PROGRESS.md` only, plus two new files under `docs/`. The baseline above therefore stands unchanged by
construction rather than by assertion. `npm test` was run anyway as a check on that reasoning and
returned **2125 passed (56 files)**, matching the recorded figure exactly.
