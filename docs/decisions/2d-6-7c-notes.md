# Phase 2d-6-7c — the operation panels' window reading, and 2d-6-7's acceptance in one place

**Status: implemented, reviewed once (`ship-with-fixes`, 0 blockers, 1 should-fix, held), fixed (§7), gates green.** Risk class: **high** (the orchestrator's
classification).

This is the last of the three sub-phases 2d-6-7 was cut into
([`2d-6-split-notes.md`](2d-6-split-notes.md) §2, *The orchestrator's cut of 2d-6-7*). Its record of
evidence is [`2d-6-7c-window-reading.md`](2d-6-7c-window-reading.md). This file records what changed,
checks 2d-6-7's whole acceptance clause by clause, and carries the open items.

---

## 1. What changed

- **No tracked source, no component, no dictionary, no test.** The window reading found **no
  defect** (reading §4), so there is nothing to pin and fix. `git status` shows only the four
  instrument paths and `PROGRESS.json` (the orchestrator's), plus the two new records.
- **The uncommitted instrument was widened** (reading §2), and it stays uncommitted:
  - `src-tauri/src/probe.rs` gained `probe_fourth_writer`, a fourth confined revision writer from
    `ECFG_PROBE_R4`;
  - `src/probe.ts` gained the cases `external-deleter`, `external-mover`, `external-duplicator` and
    `external-mover-untouched`.

  The `src-tauri/src/main.rs` / `src/main.ts` hook diff is unchanged: `5 insertions(+), 1
  deletion(-)`.
- **The harness** (outside the repository) gained `launch-7c.sh`, `tools/verbatim-7c.cjs`, two
  synthetic fixtures, and launches `T01`–`T05` and `P01`–`P08`. **2d-8 deletes all of it with the
  directory**, and it removes `probe_fourth_writer` together with the rest of the instrument's
  commands.
- **Two new records:** this file and the window reading.

Why the instrument grew rather than the plan shrank: showing supersession *withdrawing the warning*
needs a conflict already standing at the reload's second step when a further reading arrives. Reading
the reapplied arm before that needs one change more. That makes three writes to one file, and the
instrument had two.

## 2. 2d-6-7's acceptance, clause by clause

2d-6-7's entry: *"Delivers the delete, move and duplicate receivers with origin, comparison, reapply or
manual resolution and reload rendering. Acceptance: bilingual mounted interactions for every offered
control, direct submission refusal, supersession withdrawing the warning, a narrow window reading."*
The cut adds two model-side obligations handed on to 7a.

| Clause | Mounted (jsdom) evidence | Window evidence (this phase) | Verdict |
|---|---|---|---|
| **Receivers delivered and registered** for delete, move and duplicate | 7a §1.3 and §3.3: `DetailPane.test.ts` *the pane as a delivery host for the operation panels* (delivery through the real registry and coordinator, × 3; never handed to a reopened instance, × 3) | Reading §4.1: in all six operation launches a real watcher observation reached the open panel, which drew its external panel in 298–316 ms | met |
| **Origin** rendering | 7b §3 row *origin* (`changedWhileOpen`, no `refusedSave`, no *expected*; panel suites and `DPT` × 3 × EN/ES) | Reading §4.1: `changedWhileOpen` present and `refusedSave` absent, EN and ES, every panel. One 64-digit run, the observed revision, equal to the fixture's SHA-256 | met (external arm). The save arm's origin is mounted only (reading §5) |
| **Comparison** rendering | 7b §3 row *comparison* | Reading §4.1: retained operation, identity caveat, the whole disk text of the revision named, readiness line and choices. Reading §4.5: every sentence verbatim and dictionary-attributed | met |
| **Reapply** | 7b §3 row *reapply*; 7a §3.2 (the reapplies' pre- and post-adoption reads) | Reading §4.3: `reapplied` on all three panels, EN and ES. The external panel goes and the send comes back | met |
| **Manual resolution** | 7b §3 row *manual resolution* (`noCorrespondence`) | Reading §4.3: `manualResolution` plus `externalEvidence.baseRevisionMoved` on all three panels, EN and ES. The panel stays and nothing is written | met. Only one reason was read in a window (reading §5) |
| **Reload rendering, two steps** | 7b §3 row *reload* (× `installed`/`alreadyThere`/`refused` × EN/ES × 3 panels) | Reading §4.4: the second step's warning and *Close this and load it* on all three panels, then the close. Reading §4.6: the untouched mover's reload with no warning | met (window: the `installed` arm only) |
| **Bilingual mounted interactions for every offered control** | 7b §3 row *every offered control*: *Leave this as it is*, *Keep what I asked for* (both outcomes), *Load the version on disk* and *Close this and load it*, on every panel in EN and ES | Every offered conflict choice except *Leave this as it is* was also pressed in a window, in EN and ES (reading §4.3, §4.4) | met (mounted is the clause's evidence) |
| **Direct submission refusal** | 7b §3 row *direct submission refused* (deleter question withdrawn; mover and duplicator send disabled, a press sends nothing, reason beside it; held reading: *Delete it* disabled) | Reading §4.2: the deleter's question and controls gone. The mover and duplicator send `[off]`, with a forced press giving `commands=0` and `panels=1->1`, and the refusal line under it, EN and ES | met. The held-reading variant is mounted only (reading §5) |
| **Supersession withdrawing the warning** | 7b §3 row *supersession* | Reading §4.4: a fourth write at the second step. The warning, *Close this and load it* and the old revision go, and the new revision and disk text are drawn, on all three panels in EN and ES | met |
| **A narrow window reading** (ruling 38: EN and ES, changed panels and enabled controls, **one hard fixture**) | — | [`2d-6-7c-window-reading.md`](2d-6-7c-window-reading.md) §4: 8 plain-fixture proof launches (3 panels × EN/ES, plus the untouched mover × EN/ES). **§8, the hard fixture:** 4 mover launches, `H02`/`H03` over a column-five block-scalar and item-owned-comment fixture (EN/ES) and `H04`/`H05` over its CRLF variant (EN/ES). All sentences are `VERBATIM` with 0 problems, and the drawn disk text is identical to the file (LF) or equal with each CRLF read as one break (CRLF). Shakedowns: 5 plain and 1 hard | met, **with the §6 deviations**: the window was hidden, not visible, and the plans are this phase's own, not `lifecycle-delivery` |
| **Owed obligation 1** (the post-commit shape of the `deleteMatch`/`moveMatch`/`duplicateMatch` wrappers, `createMatch`'s guard) | 7a §1.1, §3.1 (14 rows pre-fix failing, 346/346 after); 7a §6 (the review's finding) | — (not window-observable) | met |
| **Owed obligation 2** (the three operation reapplies' reads after the pre-adoption look) | 7a §1.2, §3.2 (12 pre-fix failures, 279/279 after) | — | met |
| **Locale switch keeps the session** (entry 35) | 7b §3 row *locale switch* | not exercised (reading §5) | met (mounted) |
| **7b §4 item 7, what the window should look at** | — | each panel's external panel and its reveal, EN/ES (§4.1, §4.7); the untouched mover (§4.6); the deleter's withdrawn question (§4.2); the ES *Dejarlo como está* pair (§4.5); the mover's refusal beside the panel (§4.2, §4.5). **Not reached:** *Delete it* disabled under a held reading | met except the held-reading item |

**2d-6-7 is complete** on this evidence. What remains open is listed in §4 and hands on to named later
phases.

## 3. Rulings taken here

1. **The reading is a transcript plus an out-of-app attribution, not a sentence list alone.**
   6c-2 checked a list of expected keys. Here every rendered text was also reduced by every dictionary
   value, and the residue was printed (reading §4.5). That is what backs *every drawn sentence is
   verbatim*: a list of sought keys cannot see a sentence nobody thought to seek. **Not forced:** the
   attribution removes placeholder-bearing values through a one-token pattern. A value whose placeholder
   spans several words would be left in the residue. That errs toward reporting too much, not too
   little.
2. **R1 changes `:alpha`, not `:beta`.** The shakedown `T02` showed that a deletion over a snippet
   whose own text changed is refused by the exact owned-line rule. So the reapplied arm is read over a
   change elsewhere in the file, and the refusal is recorded as shakedown evidence (reading §4.3).

## 4. Open items (not fixed here, `CLAUDE.md` §7)

1. **New: the operation panels' choice row at C1 sits below the fold.** Over the plain fixture, 14 of
   23 px are visible in English and 0 in Spanish (reading §4.7). Over the hard fixture, 0 are visible
   in both (reading §8.4). This is the shape 6c-2 §5 item 5 recorded for the editor
   and the creator, and it is the same later decision. The reload's second step does reveal its choices.
2. **New: no window reading of `supersededConflict`, `noCorrespondence` or the `writeOutcomeUnknown`
   withholding.** After a supersession, the evidence gate answers `baseRevisionMoved` first (reading
   §4.3, §5). 7b §4 item 5 stays open.
3. **New, an observation and not a defect:** after `reapplied` the deleter shows *Delete this snippet*
   rather than re-raising its question (reading §4.3). The `reapplied` sentence's *send it when you are
   ready* then means two presses. For 2d-6-11's wording review, if it wants it.
4. **Carried from 7b §4**, each now also seen in a window where noted:
   - item 1, the ES *Dejarlo como está* collision (seen, reading §4.5): 2d-6-11;
   - item 2, sentences assuming an ask on an untouched mover (seen, reading §4.6);
   - item 3, the refusal repeating `fileChangedWhileOpen` (seen, reading §4.5): 2d-6-11;
   - item 4, `recovery.unavailable.operationDraft` advising a withheld reload;
   - item 5 (see item 2 above);
   - item 6, `confirmationRefused` not cleared by a delivery;
   - item 8, the editor, creator and recovery panels' reveal shape;
   - item 9, the earlier records' items.
5. **Carried from 7a:** §4 item 3 (`adoptForReapply` has no production caller) and §4 items 4-5 and §7
   item 1 as written there.
6. **Carried from 6c-2 §5 and 6b §7**, unchanged, as `PROGRESS.md` lists them. In particular, 6b §7
   item 1 must be fixed **before 2d-6-8 registers raw's and restore's receivers**.
7. **New (fix round): the disk-text panel does not show a file's line-ending convention.** A CRLF
   file draws exactly as its LF twin (reading §8.3). This is `SourceText.svelte`'s documented one-break
   rule, and a later phase decides deliberately whether a conflict comparison should say so.
8. **The window-reading instrument:** 2d-8 deletes `/private/tmp/espansoconfig-harness-2d-6-6c-2/`
   (now including `launch-7c.sh`, `tools/verbatim-7c.cjs`, the `hard*` fixtures, `T*`, `P*` and `H*`) and the instrument's
   commands, `probe_fourth_writer` among them.

## 5. Verification

Each gate was run on its own, with the output redirected to a file and read from that file. The tree
includes the widened instrument, which compiles into both the frontend and the Rust workspace.

| Command | Exit | Evidence |
|---|---|---|
| `npm run check` | 0 | **449 files**, 0 errors, 0 warnings |
| `npm test` | 0 | **3057 passed**, 65 files |
| `npm run build` | 0 | **193 modules** |
| `rg -c '\$\$payload\|head_payload\|push_element' dist/assets/index-*.js` | 1 | no match: the server-only markers are absent |
| `rg -c 'window\.__svelte\|svelte-trusted-html' dist/assets/index-*.js` | 0 | `2`: the client-only markers are present |
| `cargo test --workspace -- --test-threads=1` | 0 | **1323 passed**, 0 failed |
| `cargo clippy --workspace --all-targets -- -D warnings` | 0 | clean |
| `cargo fmt --check` | 0 | clean |
| `git diff --stat src-tauri/src/main.rs src/main.ts` | 0 | `5 insertions(+), 1 deletion(-)` |

The rung is unchanged at **`1323 / 449 / 3057 / 193`**. Only read-only git commands were run. No
commit, no push, no stash. `PROGRESS.md` and `PROGRESS.json` were not touched.

## 6. Deviations from the binding text

These are recorded here; the phase does not correct them.

1. **The instrument was modified.** The consult (`phase-2d-6-design.md:265`) and ruling 38 say to reuse
   the harness *without modifying the four instrument paths*. This phase modified two of them, both
   untracked:
   - `src-tauri/src/probe.rs` gained `probe_fourth_writer`;
   - `src/probe.ts` gained four cases and, in the fix round, `reportDiskText`.

   §1 records the reason. The `main.rs` / `main.ts` hook diff is unchanged (`5 insertions(+),
   1 deletion(-)`). 2d-6-6c-2 had modified the instrument the same way. The modification was not
   reverted.
2. **The plans are not `lifecycle-delivery`.** Ruling 38 names that trigger. These plans drive the
   same watcher delivery through their own writer calls, because `lifecycle-delivery` does not open an
   operation panel.
3. **The window was not visible.** Ruling 38 asks for a *visible* window, and the consult says
   *"querying elements in an occluded window is insufficient"*. The host's screen was locked
   throughout, and the window reported `hasFocus=false visibility=hidden`. The evidence is WebKit's
   own page snapshots, which were looked at, together with the transcripts (reading §5, §8.5). That
   is the same limit 2d-6-6c-2 recorded. A reading in a visible window remains owed wherever ruling 38
   is read strictly, and 2d-7's bilingual WKWebView reading is its natural home.

## 7. Fix round — the review's finding, and its resolution

**Review:** [`docs/reviews/phase-2d-6-7c.md`](../reviews/phase-2d-6-7c.md) (Codex, `ship-with-fixes`,
0 blockers, 1 SHOULD-FIX). **The finding** (`2d-6-7c-notes.md:55`): the window acceptance was marked
met without the hard fixture that ruling 38 and `phase-2d-6-design.md:265` require. It was
re-derived, and it holds. §2's row cited only plain fixtures.

**Resolution:**
- Four hard-fixture proof launches, `H02`–`H05`, were added (mover × EN/ES × LF/CRLF, plus the
  shakedown `H01`). They are recorded in reading §8.
- §2's row now cites them, together with this section's deviations.
- **No defect was found.** Every sentence and choice matches the plain-fixture reading. The drawn disk
  text is byte-for-byte the file's; for CRLF, each CRLF is drawn as one break, per the documented rule.
  Only the panel's height changed.
- No component, dictionary or test changed, so nothing was pinned.

**Instrument and harness in this round:**
- `probe.ts` gained `reportDiskText` and four call sites. The shakedown `H01` printed framework
  comment anchors as markers, so the probe now skips them.
- `launch-7c.sh` gained a fixture-set argument.
- `verbatim-7c.cjs` gained the disk-text comparison.
- Eight synthetic fixtures were added.

**Gates after the round.** Each was run on its own, with its output read from a file:

| Command | Exit | Evidence |
|---|---|---|
| `npm run check` | 0 | 449 files, 0 errors, 0 warnings |
| `npm test` | 0 | 3057 passed, 65 files |
| `npm run build` | 0 | 193 modules |
| server-only markers | 1 | absent |
| client-only markers | 0 | `2` |

`probe.rs` did not change in this round, so the Rust gates of §5 stand: 1323 passed, clippy and fmt
clean. `git diff --stat src-tauri/src/main.rs src/main.ts` still reads `5 insertions(+), 1
deletion(-)`.
