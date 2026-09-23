# Review brief — Phase 2d-7-design (the 2d-7 design consult and its record)

- **Repo:** /Users/ccarpio/Developer/Utils/espansoConfig (macOS Tauri v2 + Svelte 5, byte-preserving espanso YAML editor).
- **Phase:** `2d-7-design`. Goal: put 2d-7 (the reviewed temporary window-reading instrument and the bilingual WKWebView reading) to a design consult before any line of it is written, and turn the consult into a binding split record.
- **Review file:** `docs/reviews/phase-2d-7-design-record-review.md`.
- **Time budget:** 25 minutes.

## Changed files (all uncommitted, all documents; no source touched)

- `docs/decisions/2d-7-design-brief.md` — the brief the consultant read (12 questions).
- `docs/reviews/phase-2d-7-design.md` — the consult, by a Claude Opus agent (Codex out of quota until 2026-09-26 19:14). Cuts 2d-7 into ten steps.
- `docs/decisions/2d-7-split-notes.md` — **the record under review**: 36 binding rulings, the step plan 2d-7-1 … 2d-7-10 with acceptance and risk classes, the open-items map, the citation audit (154 consult citations: 148 resolve, 6 with a note, 0 fail).
- `PROGRESS.json` — the phase row marked `in_progress` (workflow record).

**Not part of this phase, never to be reviewed as its change:** `src-tauri/src/main.rs`, `src/main.ts` (two hook lines each), `src-tauri/src/probe.rs`, `src/probe.ts` — the uncommitted temporary instrument, preflight-dirty, owned by the user. The record rules on them; read them as evidence, do not treat them as the diff.

## Verification run

- `git status --short --untracked-files=all`: only the paths above plus the four instrument paths.
- `git diff --stat src-tauri/src/main.rs src/main.ts`: `5 insertions(+), 1 deletion(-)`, unchanged.
- No code gate re-run: no source changed. `cargo fmt --check` is known to fail on the uncommitted `probe.rs` only (2d-6-11b notes §6 item 6); the record assigns its fix to 2d-7-3.

## Risks to probe

1. **A ruling claiming a guarantee the code does not give** (this project's worst defect class, `CLAUDE.md` §5). Spot-check rulings against the cited code, especially the instrument rulings (command counter via wrapping the probe's handler, not `Builder::setup`; event-delivery observation through Tauri's callback `Map`; recorder-ordering; wake counter only from installation).
2. **Citation audit honesty:** re-open a sample of the audit's rows, including the "resolves" ones.
3. **Step 2d-7-9 (owner present, unlocked screen):** does the record make an unattended driven run stop `BLOCKED` without faking it, and is 2d-7-10's dependency on it coherent?
4. **Review policy:** the record must follow `CLAUDE.md` §7 — one review per phase, no review of fixes, no lettered re-review phases. Check the instrument-review step does not smuggle in a second review.
5. **The never-commit-the-probe rule** and stage-by-path discipline: does the plan contradict them anywhere?
6. **Step sizing:** is each step small enough for one worker in one session, with observable acceptance?
7. **Handed-on items** (PROGRESS.md "Next action", lines ~170-197): is every one mapped?
8. Privacy: no content from `crates/espansoconfig-core/tests/corpus/real/` quoted.

Do not run git stash/add/commit/checkout; do not modify the four instrument paths.
