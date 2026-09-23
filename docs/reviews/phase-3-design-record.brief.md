# Review brief — Phase 3-design (the Phase 3 design consult and its split record)

- **Repo:** `/Users/ccarpio/Developer/Utils/espansoConfig`, branch `main`, uncommitted tree.
- **Phase and goal:** 3-design puts plan §12 Phase 3 (complete match editing) to a design consult and
  records a binding split of it into bounded steps, before any line of Phase 3 is written. Records only.
- **Changed files (all new, untracked):** `docs/decisions/3-design-brief.md` (the brief),
  `docs/reviews/phase-3-design.md` (Codex's consult, job `task-muehnlmf-likn54`, captured verbatim with a
  provenance header), `docs/decisions/3-split-notes.md` (rulings, the fifteen-step plan `3-1` … `3-15`,
  corrections of the consult, citation audit, open-items map). `PROGRESS.json` carries only the
  in-progress marker row `3-design`; ignore it.
- **Verification run:** `git status --short --untracked-files=all` shows only those paths; no source file
  changed, so no gate was re-run (rung stays `1323 / 461 / 3546 / 200`).
- **Risks to probe:**
  1. The split record claims a guarantee the code does not give (`CLAUDE.md` §5 last bullet) — the
     project's worst defect class. Check each ruling that states what today's code does against the code.
  2. The citation audit (claimed 145 citations / 133 locations, 124 resolve, 9 with a note, 0 fail):
     spot-check a sample of `file:line` citations, especially the two "engine limits confirmed on today's
     tree" (a draft adding two missing options at once is refused; the first line of a compact snippet
     cannot be removed).
  3. Steps that contradict `CLAUDE.md` §6 invariants (single `save_document` writer, `run_one_save`, D2u,
     D2r, R25, `\r` refusal) or plan §12 scope without saying so; the record's handling of eight plan
     sentences it overrides (§8.8 atomicity and "Move to file", "Insertion method", §8.9 sidecar wording)
     without editing `IMPLEMENTATION_PLAN.md`.
  4. Placement of CF-55 (claimed: code already refuses *Undo* during a save; the defect is only the
     enabled look) and the entry-26 rulings (CF-52/CF-54 to 3-14 on an owner ruling, CF-53 owner-held);
     2d-6 split-notes §7 items 1 and 10 given no phase.
  5. Step sizing (one worker each), acceptance criteria that are observable, risk classes, and the
     driven/owner marking — including the record's departure that a model's look at a capture of a
     visible, unlocked window counts as the window reading.
  6. Privacy: no content from the gitignored real corpus quoted anywhere (`CLAUDE.md` §1).
- **Review file:** `docs/reviews/phase-3-design-record.md`.
- **Time budget:** 15 minutes.
