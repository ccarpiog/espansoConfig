# Review brief — Phase 3-8-3

- **Repo:** /Users/ccarpio/Developer/Utils/espansoConfig (macOS Tauri v2 app editing espanso YAML byte-preservingly).
- **Phase:** 3-8-3 — the local raw UI: the window half (records only, risk high). Closes step 3-8.
- **Goal:** a model's look (per `docs/decisions/3-split-notes.md` §4.1) at real `screencapture -l` captures of the Tauri window, EN and ES each set through the picker, of: (1) `RawSnippetEditor.svelte` over a contiguous snippet; (2) the disjoint-ownership refusal and its offer of the file's text view; (3) a `\r` refusal; (4) CF-55 — *Undo*/*Redo*/*Stop editing* under a held save on both raw surfaces, each capture read in the same launch as its DOM state (§4.2); (5) one hard fixture shape (R38, ruling 31). Acceptance is in `3-split-notes.md` §2 step 3-8's 2026-09-24 addendum and `docs/decisions/3-8-2-notes.md` §5.
- **Changed files (all uncommitted):**
  - `docs/decisions/3-8-3-notes.md`, `docs/decisions/3-8-3-window-reading.md` — the records (deliverables).
  - `instrument-3-8-3/{vite.config.ts, probe.ts, launch.sh, winid.swift, default.yml}` — the minimal instrument, reviewed here and deleted after this review (never committed). Captures and scratch trees are under `/private/tmp/3-8-3/L01`–`L10` (inspect them; images are readable).
  - `PROGRESS.json` — workflow marker only; not in scope.
- **Verification run (instrument in place):** `cargo test --workspace -- --test-threads=1` 1465 passed 0 failed; `cargo clippy --workspace --all-targets -- -D warnings` exit 0; `cargo fmt --check` exit 0; `npm run check` 470 files 0 errors 0 warnings; `npm test` 3773 passed; `npm run build` 204 modules. Rung `1465 / 470 / 3773 / 204`, unchanged from 3-8-2.
- **Risks to probe:**
  - Does every row claimed *read* cite a capture that actually shows what is claimed, with the DOM line drawn in the same capture (open the PNGs)? Is anything credited from a hidden page, a mounted test, or an uncredited launch (L01/L02)?
  - The held save is produced by wrapping `window.fetch` in the probe, before the request reaches Rust — do the records say exactly that and no more?
  - Does the CF-55 conclusion ("*Stop editing* dark while disabled does not reproduce") overclaim beyond what the launches show?
  - The *Redo*-enabled-after-committed-save observation: is it correctly classed (open item, not a defect claim) against `draft.ts`?
  - Privacy: no real espanso config content anywhere; fixtures synthetic only.
  - Does any record sentence claim a guarantee the evidence does not give (CLAUDE.md §5 last bullet)?
  - Instrument: could it have leaked into a committed build (`dist/`, `src/`), and are its sha256 hashes in the notes correct?
- **Review file:** `docs/reviews/phase-3-8-3.md`
- **Time budget:** 15 minutes.
