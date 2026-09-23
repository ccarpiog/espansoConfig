# Review brief — Phase 2d-7-2

- **Repo:** /Users/ccarpio/Developer/Utils/espansoConfig (review the uncommitted tree).
- **Phase and goal:** 2d-7-2 — the presentation and comment fixes, and the ES mounted cases. Binding
  spec: `docs/decisions/2d-7-split-notes.md` §2 *2d-7-2* and §3 entries 28-29. Scope is exactly five
  items: (1) a distinct disabled style on the reconciliation status control; (2) ES row marks that keep
  a file name whole; (3) the `SourceText` `.invisible` marker no longer wrapping inside a line (or its
  comment corrected); (4) the false caller claim about `tSupersededEvidence` at
  `src/lib/browser/matchEditor.ts:2664-2665` removed; (5) ES mounted cases for `AppShell`'s
  last-document removal and the save-origin adoption loops in `MatchEditor`/`MatchCreator`.
- **Changed files:** `src/lib/components/{ReconciliationStatus,FileReconciliationStatus,SnapshotAcknowledgement,Sidebar,SourceText}.svelte`,
  `src/lib/browser/matchEditor.ts`, `src/lib/browser/sourceText.test.ts`,
  `src/lib/components/{ReconciliationStatus,AppShell,MatchEditor,MatchCreator}.test.ts`, new
  `docs/decisions/2d-7-2-notes.md`. `PROGRESS.json` is a workflow record.
- **NOT in scope — ignore:** the four uncommitted instrument paths `src-tauri/src/main.rs`,
  `src/main.ts`, `src-tauri/src/probe.rs`, `src/probe.ts` (a deliberate temporary window-reading
  instrument, reviewed in 2d-7-4).
- **Verification run by the orchestrator:** `npm test` exit 0 (3547 passed, 72 files); `npm run check`
  exit 0 (462 files, 0/0); `npm run build` exit 0 (201 modules); bundle oracle correct (server-only
  markers absent, client-only present); no Rust changed. Hook diff still `5 insertions(+), 1 deletion(-)`.
- **Risks to probe:**
  - Do the stylesheet assertions actually discriminate (would they fail if the rule were removed), or
    are they vacuous string matches?
  - Does `flex-wrap: wrap` on the sidebar row really keep a file name whole, or can the name itself
    still break mid-word? Does it change the EN layout in a way the notes do not admit?
  - Does `white-space: nowrap` on `.invisible` make the component comment's claim true for every
    `SourceText` use, and does nowrap on a marker risk horizontal overflow?
  - Is the disabled style distinct from enabled in both themes / against the existing colours?
  - Do the ES mounted cases assert Spanish text from `es.json` (not the EN strings), and do they test
    the same behaviour as the EN cases they mirror? Are test-helper changes (`lang` parameter,
    `pressIn`) safe for existing callers?
  - Does any comment or record (including the notes) claim a guarantee the code does not give
    (`CLAUDE.md` §5's worst defect class)? Is every user-facing string via i18n?
- **Review file:** `docs/reviews/phase-2d-7-2.md`.
- **Time budget:** 10 minutes. Risk class `routine`.
