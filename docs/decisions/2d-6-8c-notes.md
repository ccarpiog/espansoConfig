# Phase 2d-6-8c — the raw and restore panels' window reading, and 2d-6-8's acceptance in one place

**Status: implemented, reviewed once (Codex, `ship-with-fixes`, 0 blockers, 1 SHOULD-FIX, held), fixed (§7), gates green.** Risk class: **high** (the orchestrator's
classification).

This is the last of the three sub-phases 2d-6-8 was cut into
([`2d-6-split-notes.md`](2d-6-split-notes.md) §2, *The orchestrator's cut of 2d-6-8*). Its record
of evidence is [`2d-6-8c-window-reading.md`](2d-6-8c-window-reading.md), cited below as *reading §n*.
This file does three things:
- records what changed;
- checks 2d-6-8's whole acceptance, clause by clause;
- carries the open items.

The hard fixture (ruling 38) was used from the first launch. Every proof launch ran over it: LF, its
CRLF copy, and a CRLF copy with one lone `\r`.

---

## 1. What changed

- **No tracked source, component, dictionary or test changed.** The reading found no defect in
  2d-6-8's rendering (reading §4), so there was nothing to pin and fix. It did see one pre-existing
  fault outside this step's components, which is recorded in §4 item 1 and not fixed (`CLAUDE.md`
  §7).
- `git status --short --untracked-files=all` shows the following, and nothing else:
  - the four instrument paths;
  - `PROGRESS.json`, which the orchestrator had already modified before this phase and this phase
    did not touch;
  - the two new records.
- **The uncommitted instrument was widened**, and it stays uncommitted. Only `src/probe.ts`
  changed: `e452dfb8…` → `e6b6aea2…`, then `c1fa7377…` in the fix round (§7). It gained eight cases, the helpers of reading §2, and a
  press-with-`disabled`-lifted. It gained **no new backend command**. `src-tauri/src/probe.rs` is
  unchanged (`b44b8569…`), and the `main.rs` / `main.ts` hook diff still reads `5 insertions(+),
  1 deletion(-)`.
- **The harness** gained the following, and **2d-8 deletes all of it with the directory**:
  - `launch-8c.sh`, which seeds a recognised, owner-private backup batch for the restore plans;
  - `tools/verbatim-8c.cjs`;
  - three synthetic fixtures;
  - launches `S8-01`–`S8-11` and `P8-01`–`P8-17`.

  It stays under the existing root `/private/tmp/espansoconfig-harness-2d-6-6c-2/`, not a new
  `…-2d-6-8c/` directory, because `HARNESS_ROOT` in `probe.rs` confines the writers to that root,
  and moving it would have meant changing and rebuilding the Rust half for no gain.

## 2. 2d-6-8's acceptance, clause by clause

2d-6-8's entry says: *"Delivers both receivers and the two external panels with their distinct
reload effects (reseed, retarget). Acceptance: bilingual mounted interactions; the viewer refreshes
through the guarded path while the editor conflicts; the restore candidate survives; CR disclosure;
a narrow window reading."* The cut adds three owed model-side obligations, which went to 8a.

| Clause | Mounted (jsdom) evidence | Window evidence (this phase) | Verdict |
|---|---|---|---|
| **Both receivers delivered and registered** | 8a §2 and §4.3: raw and restore receivers reported through `bindReceiver`, registered from `DetailPane.svelte`, delivered through the real registry and coordinator (`DetailPane.test.ts`) | Reading §4.1: in every raw and restore launch, a real watcher observation reached the open surface, which drew its panel in 304–346 ms | met |
| **The two external panels** (origin, observed revision, comparison, entry 10 and 23) | 8b §3 rows *origin*, *comparison*, *externalMessages* | Reading §4.1: `changedWhileOpen`, and no `refusedSave`, `changedElsewhere`, `nothingWasWritten`, *expected* or *found*. One revision equal to the fixture's SHA-256. The surface's two lines. The whole disk text, `exact` against the file (LF) or with each CRLF drawn as one break. §4.8: every sentence attributed, with an empty residue. EN and ES | met |
| **Reveal** | 8b §3, three reveal cases | Reading §4.1: C1 lands the panel's top at the scroller's top, and the choices are below the fold over the hard fixture. At the second step the choices are brought into view (22–23 of 23 px) | met (see §4 item 2 for the fold) |
| **Distinct reload effects: raw reseed** | 8b §3 row *distinct reload effects* × `installed`/`alreadyThere`/`refused` | Reading §4.3: the box holds R4 (and in `P8-03`/`04` R2) **byte-exact**, editable and clean, the panel gone, the editor open, no `reload_document` | met (window: `installed` only) |
| **Distinct reload effects: restore retarget** | 8b §3, real adoption; *keeps the candidate whatever the window answers* | Reading §4.3: panel gone, candidate unchanged, *Prepare* enabled. The next send carried `baseRevision` = the adopted revision (R2), and the file ended as the candidate's bytes. Over the CRLF copy the CRLF candidate was written byte for byte | met (window: `installed` only) |
| **The viewer refreshes through the guarded path while the editor conflicts** | 8b §2 ruling 4, `DetailPane.test.ts` × EN/ES | Reading §4.6: no editor, change → `reload_document(1)`, and the viewer draws R1 `exact`. Editor open, change → panel, with **0** rereads of that file. During the conflict, another file's change → `reload_document(2)`, and the panel's revision is unmoved | met. As in 8b, the viewer and the editor are never on screen together. The `document_text(1)` cache read beside the other file's reload is recorded in reading §4.6 |
| **Restore candidate survives** | 8b §3 row *restore candidate survives* | Reading §4.2/§4.3: the candidate is `exact` before the change, at C1, after supersession and after the retarget. §4.7: dropped by the person's own choice and brought back, with the panel's lines following | met |
| **CR disclosure** | 8b §3 row *CR disclosure* | Reading §4.4: a disk text with CRLF lines and a lone `\r`. The marker (`carriage return U+000D` / `retorno de carro U+000D`) on **both** panels. Raw draws `diskLineEndingsNotPreserved` and a disabled *Discard my text and load it*, whose forced press adopts nothing. An LF supersession lifts it. Raw's opening refusal over the CRLF copy (`P8-05`/`06`) | met. A CRLF-only text is drawn one break per line and **not** named (7c notes §4 item 7, still open). The marker wraps (§4 item 1) |
| **Direct submission refused** (a forced press issues 0 commands) | 8b §1.4 *Direct submission is pressed* | Reading §4.2: raw *Save* and restore *Prepare* disabled. Pressed as they are and with `disabled` lifted: `save_raw_document`, `reload_document` and `document_text` counts unchanged, and the question not drawn. The confirmation question and *Replace entire file* are withdrawn under the conflict | met |
| **Supersession withdraws the warning** | 8b §3 row *supersession* | Reading §4.3: a change at the second step withdrew the confirmation and the old revision and drew the new ones, on both panels in both languages | met |
| **Every offered control, both locales** | 8b §3 row *every offered control* | Reading §4.1/§4.3: every choice label drawn in EN and ES. Pressed in a window: *Load the version on disk*, *Discard my text and load it* and *Load it and keep the text selected here*. Not pressed: *Keep editing*, *Copy my text* and *Leave this as it is* | met (mounted is the clause's evidence) |
| **Locale switch keeps the session** (entry 35) | 8b §3 row *locale switch*, both panels | Reading §4.5: the raw editor, mid-conflict, EN→ES and ES→EN. The draft is kept, the sentences redrawn, and the disabled confirmation kept | met. Window: raw only |
| **Owed obligation 1**: raw's and restore's reloads given the `confirmationOf` / `settledAnswer` shape | 8a §1.1, §4.2 (pre-fix failures verbatim), §7.2 | — (not window-observable beyond the reseed and retarget working, reading §4.3) | met |
| **Owed obligation 2**: `BrowserState.restoreDocument` and its reader | 8a §1.2 | — | met |
| **Owed obligation 3**: the raw and restore wrappers' post-answer shape | 8a §1.3, §4.1, §7.1 (the review's BLOCKER, fixed) | Reading §4.3: four committed restore sends each answered as a success, with `browser.restore.replaced` drawn | met |
| **8b §4 item 1, what 8c should look at** | — | Both panels and their reveal, EN/ES (§4.1). The restore refusal line (§4.2). The reseed and retarget (§4.3). The `\r` on both panels (§4.4). **Not reached:** raw's notices under *Save*, restore's notice beside its refusal, and the no-candidate reload-unavailable sentence (reading §6) | met except the unreachable states, which are named as unread |
| **A narrow window reading** (ruling 38: EN and ES, changed panels and enabled controls, one hard fixture) | — | [`2d-6-8c-window-reading.md`](2d-6-8c-window-reading.md): 16 counted proof launches (8 plans × EN/ES; `P8-09` replaced by `P8-17`), all over the hard fixture (LF, CRLF, CRLF + lone `\r`), and the fix round's four (`P8-18`–`P8-21`, reading §9). Every sentence `VERBATIM` with 0 problems. Every disk text, candidate and box matched to fixture bytes. **Inspected by eye (reading §9.2), for each of raw EN, raw ES, restore EN and restore ES:** (a) the panel's top at C1: origin, lines, revision, disk text; (b) the C1 choice row with *Load the version on disk*, brought into view by the **probe's** scrolling, because the app's reveal leaves it below the fold; (c) the second step's choice row with the enabled confirmation (*Discard my text and load it* / *Load it and keep the text selected here*), in view after the **app's own** reveal. Plus raw EN and restore ES over the `\r` text. *Enabled* is the transcripts' reading (no `[off]`), consistent with the images | met, **with the §5 deviations and two narrowings**: the C1 row is inspected only after the probe's scroll (the reveal does not reach it, §4 item 2), and the reseed/retarget results rest on transcripts, not on an opened snapshot (reading §9.3). The unread states of reading §6 stay unread |

**Also read, beyond the clauses:** the save arm's own origin, `refusedSave`, on both panels (reading
§4.9, `P8-13`–`P8-16`). The operation panels' reading could not produce it (7c reading §5).

**2d-6-8 is complete** on this evidence. What remains open is in §4, handed on.

## 3. Rulings taken here

1. **A disabled control is pressed twice: as it is, and with `disabled` lifted for one press.** The
   first shows that a real engine dispatches nothing. The second makes the component's handler run,
   so that the refusal observed is the model door's and not merely the attribute's. **Not forced:**
   lifting the attribute is the probe's own act; no person can do it. So the second press shows
   that the door refuses, not that the path is reachable.
2. **The restore candidate comes from a harness-seeded backup batch**, not from a save through the
   application. That keeps every byte change before the send an external writer's, and it makes the
   candidate a chosen synthetic file whose bytes the send can be compared against. **Not forced:**
   the batch was minted by the harness, not by this app's rotation. The listing recognises its
   shape; that is all the pane claims of any batch (`browser.restore.batchOrder`).
3. **The attribution removes the drawn disk text before any dictionary value.** A placeholder
   pattern can otherwise reach into the file's own words: the shakedown `S8-02` showed
   `carriage return \S+` eating a fixture word. **Not forced:** a dictionary sentence that happened
   to occur inside a fixture would be removed as file text. The fixtures hold none.

## 4. Open items (not fixed here, `CLAUDE.md` §7)

1. **New: `SourceText.svelte`'s invisible-character marker wraps inside a file line** (reading
   §5.1). `.invisible { white-space: normal }` gives the line breaker a wrap opportunity between the
   marker's words. When a line holding a marker is wider than the box, the marker breaks and the
   rest of that file line starts a new visual line at column zero. The component's comment claims
   *"every visual line is a line the file has"*, and in this case that claim is false: a comment
   claiming a guarantee the code does not give (`CLAUDE.md` §5). It affects every `SourceText`, not
   only 2d-6-8's panels.

   A likely fix is `white-space: nowrap` on the marker. It needs a deliberate phase: jsdom cannot
   show layout, so pinning it needs a window reading or a stylesheet assertion. **Recommended to the
   orchestrator as a small corrective item.**
2. **Carried and widened: the choice row below the fold at C1.** Over the hard fixture, raw and
   restore show 0 of 23 px in both languages (reading §4.1). This is the operation panels' 7c notes
   §4 item 1 and 6c-2 §5 item 5. The second step does reveal its choices.
3. **Carried: a CRLF-only disk text is not named on either panel** (7c notes §4 item 7). A person
   cannot tell `hard` from `hardcrlf` in the comparison. On raw the reseed refusal sentence does say
   *carriage returns*; restore says nothing. The viewer's own scope line says *"every line ending is
   drawn as one line break"* (reading §4.4); the conflict panels have no such line.
4. **New, observed and not diagnosed:** after a save refused under the lock because another writer
   had just changed the file, no drain ever delivered the watcher's reading of that change (reading
   §4.9). The save panel was all the window drew. Whether the backend ledger deliberately swallows
   a revision the save conflict already reported is a question for 2d-6-9's reconciliation-status
   work, not a claim made here.
5. **New, instrument only:** `P8-09` stopped mid-plan with no terminal line (reading §6). The re-run
   passed. If a later reading sees it again, `CLAUDE.md` §6's occluded-window timer stall is the
   first suspect.
6. **Carried from 8b §4**, each now also seen in a window where noted:
   - item 2, restore's `externalConflict` refusal repeating `fileChangedWhileOpen` (seen, reading
     §4.2): 2d-6-11;
   - item 3, the candidate lines after a conflict raised over none (not read);
   - item 4, *Load it and keep the text selected here* offered with no candidate (not read: the
     second step was not taken after a drop): 2d-6-11;
   - item 5, `recovery.unavailable.operationDraft` on restore: 2d-6-11;
   - item 6, `acknowledgeSnapshot` / `acknowledgeRestoreSnapshot` drawn by nothing: 2d-6-9;
   - item 7, the earlier records' items.
7. **Carried from 8a** §5 and §7.3, and from 7c/7b/6c-2, unchanged, as `PROGRESS.md` lists them.
8. **The window-reading instrument:** 2d-8 deletes `/private/tmp/espansoconfig-harness-2d-6-6c-2/`.
   That now includes `launch-8c.sh`, `tools/verbatim-8c.cjs`, the `hardcr*` and `*candidate`
   fixtures, and `S8-*` and `P8-*`. 2d-8 also deletes the instrument's cases and commands.

## 5. Deviations from the binding text

These are recorded here and not corrected by this phase.

1. **The instrument was modified.** Ruling 38 says to reuse the harness without modifying the four
   instrument paths. This phase modified `src/probe.ts` (untracked) for the reason in §1, as 6c-2
   and 7c did. `probe.rs` and the hook diff are unchanged.
2. **The plans are not `lifecycle-delivery`.** They drive the same watcher delivery through their
   own writer calls, because `lifecycle-delivery` opens no write surface.
3. **The window was not visible.** The screen was locked throughout: every `screencapture -x` is
   black, and the window reported `hasFocus=false visibility=hidden`. The evidence is the
   transcripts, the out-of-app comparison and the WebKit page snapshots listed in reading §9.2 (fourteen). A reading
   in a visible window remains owed wherever ruling 38 is read strictly; 2d-7's bilingual WKWebView
   reading is its natural home.
4. **Unreachable states are named as unread** (ruling 38 asks for exactly that): the two notices,
   the no-candidate reload-unavailable sentence, and the `alreadyThere` / `refused` adoption arms
   (reading §6).

## 6. Verification

No tracked source changed, so the brief's minimum was owed: `npm test` and `npm run check`. Each was
run on its own, with output redirected to a file and read from it. The tree includes the widened
instrument.

| Command | Exit | Evidence |
|---|---|---|
| `npm run check` | 0 | **449 files**, 0 errors, 0 warnings |
| `npm test` | 0 | **3156 passed**, 65 files |
| `npm run build` (for the proof binary) | 0 | **193 modules** |
| `cargo build -p espansoconfig --features custom-protocol` (for the proof binary) | 0 | binary `9f91e512…` |
| `git diff --stat -- src-tauri/src/main.rs src/main.ts` | 0 | `5 insertions(+), 1 deletion(-)` |

The rung is unchanged at **`1323 / 449 / 3156 / 193`**: Rust was not re-run, and no Rust source
changed. Only read-only git commands were run. No commit, no push, no stash. `PROGRESS.md` and
`PROGRESS.json` were not touched.

## 7. Fix round — the review's finding, and its resolution

**Review:** [`docs/reviews/phase-2d-6-8c.md`](../reviews/phase-2d-6-8c.md) (Codex, `ship-with-fixes`,
0 blockers, 1 SHOULD-FIX). **The finding** (this file's §2, the *narrow window reading* row): the
window acceptance was marked met, but the reading had inspected only two snapshots, raw in English
and restore in Spanish. In the restore one, the choices were below the viewport. **Re-derived, and
it holds.** The reading's §7 listed exactly those two.

**Resolution:**
- **The existing snapshots were opened and looked at, for both panels in both languages.** That is
  the C1 top and the second step of `P8-01`, `P8-02`, `P8-07` and `P8-08`, plus the C1 top of
  `P8-19` and `P8-20`.
- **Four launches were added**, `P8-18`–`P8-21` (`external-raw` and `external-restore` × EN/ES). The
  uncommitted `src/probe.ts` now scrolls the C1 choice row into view by the probe's own hand and
  takes one more snapshot. All four passed, with 32 / 32 / 42 / 42 sentences and 0 problems (reading
  §9.1).
- Reading §9.2 names every snapshot looked at, per panel and language. §2's row now says exactly
  what was inspected, and names the two narrowings: the C1 row only after the probe's scroll, and no
  opened snapshot of the reseed or the retarget.
- **Nothing new was found.** Every label is the dictionary's, and no row is clipped. The C1 row's
  position below the fold is already §4 item 2.
- **No tracked source changed.** `probe.rs` and the `main.rs` / `main.ts` hook diff are unchanged.

**Gates after the round:** `npm run check` exit 0 (449 files, 0 errors, 0 warnings) and `npm run
build` exit 0 (193 modules), each run alone with its output in a file. `npm test` was not re-run:
only the untracked instrument changed, and no suite imports it.

