# Review brief — Phase 2d-7-7 (R38: the fifteen byte-exact fixtures, a window reading, records only)

- **Repo:** `/Users/ccarpio/Developer/Utils/espansoConfig`
- **Phase and goal:** 2d-7-7 — draw each of the fifteen `CLAUDE.md` §4 byte-exact fixtures in the raw
  viewer and on one conflict panel (or the viewer's refresh where no match projects) with the **frozen**
  window-reading instrument; EN for all fifteen, ES for three. Spec: `PROGRESS.md` *Next action*;
  `docs/decisions/2d-7-split-notes.md` §2 *2d-7-7*, §3 entries 16, 18, 22, 34, 35; known instrument gaps
  in `docs/decisions/2d-7-4-2-notes.md` §8 item 1.
- **Changed files (uncommitted, the whole review subject):** `docs/decisions/2d-7-7-notes.md`,
  `docs/decisions/2d-7-7-window-reading.md` (new). `PROGRESS.json` carries only the `in_progress` marker.
  The four instrument paths (`src-tauri/src/main.rs`, `src/main.ts`, `src-tauri/src/probe.rs`,
  `src/probe.ts`) are deliberately uncommitted and frozen — not part of this change; do not review them.
  Scratch evidence is under `/private/tmp/2d7-7-*` and the harness at
  `/private/tmp/espansoconfig-harness-2d-6-6c-2/`.
- **Worker's claim:** 18 launches (15 EN, 3 ES), none voided; four hashes equal per fixture; viewer text
  matches the bytes out of the app (11 exact, BOM via its label, two CRLF fixtures with CRLF drawn as one
  break); every fixture drawn in the raw viewer only. **The clause "each fixture has its panel or refresh
  line and `writes=0`" is NOT MET** — the frozen instrument has no successor fixtures and no plan that
  writes a byte-level edit of the fixture — and the phase stops **BLOCKED** for an owner ruling with
  options (a) record unread, (b) instrument revision, (c) `external-raw` refresh (advised against).
- **Verification run by the orchestrator:** `/private/tmp/2d7-6-1-hashcheck.sh` → `summary ok=18 diff=0`;
  `git diff --stat src-tauri/src/main.rs src/main.ts` → `5 insertions(+), 1 deletion(-)`; `npm test` →
  3547 passed; `/private/tmp/2d7-7-cargo.log` → 26 `test result: ok`, none failing. Worker: fmt, clippy,
  `npm run check` (462), `npm run build` (201, oracles correct), all exit 0.
- **Risks to probe:** (1) any claim in the records stronger than the evidence (entry 22: no edit
  byte-exactness, no editor-over-`\r` claim; S5: `writes=0` only as a whole-launch tally, never a
  per-action witness); (2) whether the BLOCKED judgement is justified — could the frozen tools really not
  produce the panel/refresh line, and does the record truly give that clause no "unread" alternative;
  (3) whether the verbatim comparison is honest about CRLF and BOM limits; (4) whether the four hashes are
  really four independent measurements; (5) privacy (entry 34): no real-config content, no screen capture
  quoted or copied; (6) the `raw-open-crlf` MISMATCH lines on non-CRLF fixtures classed correctly.
- **Review file:** `docs/reviews/phase-2d-7-7.md`
- **Time budget:** 15 minutes.
