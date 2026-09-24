# Review brief — Phase 3-9-2

- **Repo:** /Users/ccarpio/Developer/Utils/espansoConfig (uncommitted tree)
- **Phase:** 3-9-2 — the file-scope inspector's window half (records only). Closing it closes step 3-9.
- **Goal:** a model's look (`docs/decisions/3-split-notes.md` §4.1, ruling 30) at `screencapture -l` captures of a visible, unlocked window, EN and ES set through the picker, fresh bundle path per launch, over five shapes: ordered imports with an unsupported entry, no `imports` key, empty list, a `_` match file (note + sidebar tooltip), a `_` config profile (neutral note).
- **Changed files:** `docs/decisions/3-9-2-notes.md`, `docs/decisions/3-9-2-window-reading.md` (new records); `PROGRESS.json` (in-progress marker only). The untracked `instrument-3-9-2/` directory is the minimal uncommitted instrument; it is deleted after this review and never committed. Captures live outside the repo in `/private/tmp/3-9-2/` (L02 EN, L03 ES).
- **Verification run:** instrumented `npx tauri build --debug` exit 0; three launches (L01 exploratory, L02 EN, L03 ES), `IOConsoleLocked = No` around every capture; a plain `npm run build` afterwards exit 0, 207 modules, bundle oracle clean. No committed source file touched, so the rung stays `1465 / 474 / 3822 / 207`.
- **Risks to check:**
  1. Does any record claim more than a capture shows (the project's worst defect class)? Tooltips are recorded unread (DOM `title` evidence only) — check the wording keeps that distinction.
  2. Finding F1: the imports list draws numbers only for entries 2 and 4 (the reason-sentence entries); entries drawn through `SourceText` have no marker. The orchestrator has confirmed this in `/private/tmp/3-9-2/L02/cmp-list.png`. The worker's cause is a guess and is labelled as such — check that. Decide whether F1 is a blocker for closing 3-9 (a visible defect in the thing the step delivers) or an open item for a later phase.
  3. Privacy: fixtures and records must hold synthetic content only.
  4. Deviations recorded: one launch per language walking all five files rather than one launch per shape; new synthetic fixtures rather than corpus copies.
- **Review file:** `docs/reviews/phase-3-9-2.md`
- **Time budget:** 10 minutes.
