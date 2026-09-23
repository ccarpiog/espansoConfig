# Review brief — Phase 2d-7-4-1: the instrument's harness and tools

- **Repo:** `/Users/ccarpio/Developer/Utils/espansoConfig` (macOS Tauri v2 app; rules in `CLAUDE.md`).
- **Review file:** `docs/reviews/phase-2d-7-4-1.md`. **Time budget:** 15 minutes.
- **Phase and goal:** the first half of 2d-7-4, cut before it started at the one boundary
  `docs/decisions/2d-7-split-notes.md` §2 permits (see the *Addendum 2026-09-23* at the end of the
  `### 2d-7-4` section). It builds the window-reading harness and the synthesized-input tool.
  **This is NOT the instrument review** — that is 2d-7-4-2's, over the whole instrument. A finding
  about `src/probe.ts` or `src-tauri/src/probe.rs` goes in as an open item for 2d-7-4-2, not a blocker here.

## The subject is outside the repository

The uncommitted repo tree carries only records (`docs/decisions/2d-7-4-1-notes.md`, the split-notes
addendum, `PROGRESS.json`). The code under review is in the harness root
`/private/tmp/espansoconfig-harness-2d-6-6c-2/`:

- `launch-7.sh` (new) and `fixtures-7.manifest` (new), `fixtures-src/synthetic-7/` (five synthetic sources);
- `tools/post-input.swift` (the entry-20 synthesized-input tool; built, deliberately **not** exercised on a
  real window) and `tools/lockstate.swift` (the lock-state reader), with their built binaries.

Read them directly. The notes (`docs/decisions/2d-7-4-1-notes.md`) hold the design choices, the evidence
transcripts (§3), the hashes (§5), deviations (§6), limits (§7) and open items (§8).

## What to check

Against the record's `### 2d-7-4` *Delivers* list for the harness half, and §3 entries 2-7, 14-16, 19,
20 and 34 where they bind the harness:
1. **Per-launch bundle identifier and fresh bundle path** — can two launches ever share either? Is reuse refused?
2. **Window-only captures** — can any path capture the full screen? Is the locked-screen fallback to the
   WebKit page snapshot stated in the output, never silent?
3. **Lock-state preflight line** — is it printed first on every launch, and can it report "unlocked" wrongly?
4. **Script-side writers and bursts** — do they write only inside the launch's own synthetic tree (never the
   user's real `~/Library/Application Support/espanso` or `~/.config/espanso`)? Are the recorded hashes honest?
5. **SHA-256 fixture import** — any path where a mismatched or missing-from-manifest fixture lands anyway,
   including a tampered file already present in `fixtures/`?
6. **The input tool** — does it target only the named process/window, refuse on a locked screen or without
   Accessibility, and is there any path where it posts events system-wide?
7. **Records** — does any sentence in the notes claim a guarantee the scripts do not give (this project's
   worst defect class)? Is the evidence a transcript, not an assertion?

## Verification already run (instrument present, all exit 0)

`cargo fmt --check`; `cargo clippy --workspace --all-targets -- -D warnings`;
`cargo test --workspace -- --test-threads=1` (1330 passed); `npm run check` (462 files, 0/0); `npm test`
(3547); `npm run build` (201 modules). The four instrument paths are byte-identical to the phase start
(hashes in notes §0); `git diff --stat src-tauri/src/main.rs src/main.ts` is `5 insertions(+), 1 deletion(-)`;
`bash -n launch-7.sh` exits 0.

## Risks the orchestrator sees

- The screen was locked for the whole phase, so the unlocked `used=window` capture branch never ran.
- The page does not yet print the `--- script-*` lines, so the in-launch writer handler was exercised by
  sourcing the script's functions against an app-less test tree (notes §6).
- Unexplained lower-case `~/Library/{WebKit,Caches}/espansoconfig` directories were reported, not deleted.

Do not run `git stash`, `git checkout`, `git restore` or `git reset`. Do not launch the app. Do not read
the gitignored real corpus.
