# Phase M2 — the review-tail termination rule

Reviewer: Codex (`gpt-5`-class, high effort), job `task-mtekkzkm-is4aat`, 2026-08-29.
Target: the conventions change in `CLAUDE.md` §7 and ~line 353, the standing-rules bullet in
`PROGRESS.md`, and `docs/decisions/review-tail-termination.md`. No source file was touched.

## Round 1 — verdict `not-ready`: 2 High, 2 Medium, 1 Low

The reply below is verbatim, less the Codex session-ID trailer.

---

VERDICT: not-ready

HIGH:

- A source-changing Low fix can ship unreviewed. Round R reports 0 High, 0 Medium, and a Low requiring code modification. `CLAUDE.md:594-597` says “A step closes” on 0 High/Medium; lines 603-604 say “Fixing a Low does not open a round.” The fix then changes source and accidentally introduces a correctness defect. Lines 584-586 simultaneously say such a fix “is owed a review round.” The rule gives contradictory outcomes, and both `PROGRESS.md:97-99` and the closure clause favor no review.

- Behavior-affecting files are incorrectly excluded. Lines 576-580 define everything outside three directories as “the record”; lines 588-590 therefore commission nothing after fixes to `src-tauri/tauri.conf.json`, `src-tauri/capabilities/default.json`, `src-tauri/build.rs`, `src-tauri/Cargo.toml`, root `Cargo.toml`, `vite.config.ts`, `svelte.config.js`, `tsconfig.json`, `package.json`, lockfiles, or `scripts/*`. Concrete sequence: a review finds the `custom-protocol` feature wrong; the manifest fix introduces another mistake; no review follows. `src-tauri/Cargo.toml:52-67` documents that this feature determines whether production loads bundled assets or a dead development URL and that its prior absence yielded a blank application. Test fixtures and i18n data currently reside under `crates/` and `src/`, respectively, so those are covered; no CI configuration was present.

MEDIUM:

- The first record-only High/Medium round has no coherent successor. Lines 588-590 say its prose-only fix commissions nothing, while lines 594-597 do not close until two consecutive no-source rounds; lines 644-645 say §7.2 is the only hand-driven stopping rule. Thus the step is neither closed nor able to obtain the second round required to close it.

- A 0-High/0-Medium verdict containing an actionable “where it is thin” item is undecided: lines 594-597 require closure, while lines 618-619 say the actionable item “can commission a round.” “Can” also leaves who decides unspecified. The claimed acceptance property at lines 599-601 is therefore false for this verdict shape.

LOW:

- The decision record says the new file was “renamed from `docs/goahead-review-tail-issue.md`,” but Git shows only a new untracked file and no tracked deletion, so the repository does not support that provenance claim.

NOT-VERIFIED: The asserted `~/.claude/scripts/goahead-base.md` cap and after-second-review behavior; that file is outside the repository and the requested review inputs. No executable checks were relevant to this conventions-only change.


## Round 2 — verdict `not-ready`: 1 High, 1 Medium, 3 Low (and one clearance)

Reviewer: Codex (high effort), job `task-mtekyttf-cofpml`, 2026-08-29. Run against round 1's fix.
The reply below is verbatim, less the Codex session-ID trailer.

---

VERDICT: not-ready

HIGH: The rule cannot both terminate universally and review every source change. Outside `goahead`, `CLAUDE.md:668` claims “**The rule terminates**,” but a sequence where every review exposes a defect and every fix changes source commissions rounds forever. Under `goahead`, the opposite failure occurs: §7.1 says a source fix “**is owed a review round**” (`CLAUDE.md:631`), while §7.4 says that when the cap is reached “**the phase closes**” (`CLAUDE.md:730-733`). Sequence: review 1 → source fix → review 2 → source fix → cap closes phase; the second source fix is unreviewed. Before that cap, cases (a), (b), and (d) close; (c), (e), (f), and (g) commission a round—the revert in (g) still changes a source file in its immediate diff.

MEDIUM: §7.3 still permits a known defect to close with the step. It defines actionable as “**a named defect**” (`CLAUDE.md:712`) but says “**No item in that section commissions a round**” and a later phase merely “**may adopt**” it (`CLAUDE.md:700-704`). Sequence: a round records a source correctness defect only as actionable, makes no fix, and therefore closes; no later phase is required to adopt it.

LOW:

- `CLAUDE.md:670-672` says step 2 “**stops at round 5**” and simultaneously that “**round 5 was never commissioned**”; it stops after round 4. The decision record repeats this at lines 83-85.
- `CLAUDE.md:361-362` and `PROGRESS.md:104-105` claim the new source-only rule ran the nine-round tail, contradicting `CLAUDE.md:575`, which says rounds 4–9 changed no source file.
- The corrected provenance still asserts an unverifiable move: “**This file — moved here from**” an untracked file (`docs/decisions/review-tail-termination.md:79-81`). Git supports only the stated new-untracked/no-tracked-deletion status, not the move.
- No closed-list ambiguity found. All previously omitted manifests, configs, scripts, and lockfiles are now source; both tracked `README*` files are prose, and every tracked `docs/` file is Markdown.

NOT-VERIFIED: The external `~/.claude/scripts/goahead-base.md` cap and after-second-review behavior; it is outside the repository. No executable checks were relevant.

