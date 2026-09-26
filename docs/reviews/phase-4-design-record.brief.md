# Review brief — the Phase 4 design consult record

- **Repo:** /Users/ccarpio/Developer/Utils/espansoConfig (macOS Tauri v2 espanso YAML editor; byte-preserving edits).
- **Phase:** Phase 4 design consult (plan `IMPLEMENTATION_PLAN.md` §12 `### Phase 4 — variables and forms`). Records only.
- **Goal:** cut Phase 4 into bounded, individually reviewable steps before any code is written, and map every open item carried out of Phase 3 (`docs/decisions/3-closure-notes.md` §6, 47 items) plus the 3-6-3 candidate defect (`PROGRESS.md`, "Handed on by 3-6-3").
- **Changed files (uncommitted):**
  - `docs/decisions/4-design-brief.md` — the brief sent to the consultant (left as sent).
  - `docs/reviews/phase-4-design.md` — Codex's consult (job `task-mui8fw1w-ga5pke`, high effort), saved verbatim.
  - `docs/decisions/4-split-notes.md` — the binding record: 24 steps `4-1` … `4-24`, rulings, corrections of the consult, plan sentences overridden, citation audit, open-items map.
  - `PROGRESS.json` — the orchestrator's in-flight marker; not under review.
- **Verification run:** records only; `git status --short --untracked-files=all` shows only the files above. No cargo or npm gate is owed because no source changed.
- **Risks to check hardest:**
  1. **Claims about the code that are false.** The record says A1 (quoted `'true'` from *Create* with a seeded default and from the single-match editor) has a core obstacle — the no-new-ambiguous-plain-scalar check does not exempt new snippets — and prescribes a narrowed exemption. Verify against `crates/espansoconfig-core` and `src/lib/browser/` that this is how the code behaves today, and that the prescribed fix does not contradict D2u / R16's closed half (`PROGRESS.md` R16, `CLAUDE.md` §6).
  2. **A guarantee the code cannot give** stated as if it could (`CLAUDE.md` §5 last bullet — this project's worst defect class).
  3. **The open-items map is complete and honest**: every one of the 47 items of `3-closure-notes.md` §6 and the 3-6-3 item appears exactly once, and none is silently dropped or relabelled.
  4. **Each step is bounded** (one worker can finish it), has observable acceptance criteria and a risk class, and is marked driven vs. window/owner. The four window steps (4-13, 4-16, 4-20, 4-23) are correctly set aside for driven runs per `3-split-notes.md` §4.8.
  5. **Standing rules kept**: D2u, D2r, R25, `save_document` sole writer, core never depends on tauri, i18n EN+ES, the `\r` textarea/input rule for any new editor, `shell`/`script` never executed by preview.
  6. **Corpus privacy**: no real espanso config content quoted anywhere.
  7. **The review policy** (`CLAUDE.md` §7): the record must not create re-review phases or lettered fix phases.
- **Review file:** `docs/reviews/phase-4-design-record.md`
- **Time budget:** 15 minutes.
