# Phase 2d-7-9 — G5: the owner-present, unlocked-screen visible session (notes)

**Date:** 2026-09-23.
**Spec:** [`2d-7-split-notes.md`](2d-7-split-notes.md) §2 *2d-7-9*, bound by §3 entries 18 (the three
visibility conditions), 20 (synthesized input is 2d-7-9's alone; the copy stays the owner's gesture), 21
(owner-present, never driven), 25 (every visual judgement in both languages) and 26 (the close and keep
labels and the C1 fold are surfaced in the owner's words and never changed in 2d-7); also 17 (no
substitution armed in 2d-7-9), 19 and **37** (the owner's standing ruling). The G5 rows are the consult's
([`phase-2d-7-design.md`](../reviews/phase-2d-7-design.md) `:454-495`); the handed rows are listed in
`PROGRESS.md` *Next action*.
**Risk:** `high`. **Driven:** no — run from the interactive main session with the owner at the unlocked
screen, as the owner chose on 2026-09-23 (option (a) of the 2d-7-8 next action). **Records only:** this
file and [`2d-7-9-window-reading.md`](2d-7-9-window-reading.md). No tracked source changed; the
instrument and the harness were not edited; no plan, fixture or manifest line was added. No real-config
file was opened, copied, quoted or used as a launch input.

**Who did what.** The orchestrator ran the nineteen launches (`G5-01` … `G5-19`) and put every question to
the owner, logging each owner statement verbatim (the session log,
`/private/tmp/claude-501/…/scratchpad/g5-session.md`). This worker wrote the two records from that log and
the launch directories, re-checking every quoted number against `probe.log`, `launch.txt` and `bytes.txt`
and re-running the pixel comparison; it launched nothing and addressed no one. Owner statements are the
owner's; the orchestrator's looks at captures are **a model's reading, never the owner's**.

**Outcome.** Of the seven G5 rows, **three are read** (the foreground case, with its premise found not to
hold; ⌘Q, read as "no page-lifecycle line"; the visible re-takes), **one is read in part** (the visual
judgements: four of five by the owner, the disabled status control not visible in this session), and
**three are unread** (Tab and default activation, pointer hit-testing, *Copy my text*), each with its
missing capability named. Every row handed on by 2d-7-5 … 2d-7-8 is classed in §3b; three are read today, in whole or in part (H8, H9, H14),
the rest stay unread for want of a plan. The step closes under entry 37:

> For the rest of 2d-7, any row the frozen instrument cannot read is recorded unread and hadnded to 2d-7-9 and 2d-7-10.

---

## 1. The frozen instrument, checked before the session, before the records and after the gates

`/private/tmp/2d7-6-1-hashcheck.sh` (unchanged):

| When | Result | By |
|---|---|---|
| 18:17:21, before the first launch | `summary ok=18 diff=0` | the orchestrator (session log) |
| after the last launch | `summary ok=18 diff=0`, binary `53d84fb2…` | the orchestrator (session log) |
| 18:51:26, before these records | **18 of 18 `OK`**, 0 `DIFF` (`/private/tmp/2d7-9-hashes-start.txt`) | this worker |
| after the gates | **18 of 18 `OK`**, 0 `DIFF` (`/private/tmp/2d7-9-hashes-end.txt`) | this worker |

`target/debug/espansoconfig` was `53d84fb2f2060d03db217cd5381dbaceb884fa1fc236c99b6ce481e0adaa510b` at
every check. `git diff --stat src-tauri/src/main.rs src/main.ts` read `2 files changed, 5 insertions(+), 1
deletion(-)` before and after.

---

## 2. What was done, and why

1. **Preflight** (orchestrator): hash check; lock preflight `lock=unlocked
   rule=primary-unlocked-and-cross-check-not-locked` (18:20:24). Instrument facts found before any launch
   and recorded here because they decide three rows: `src/probe.ts` prints no `isTrusted` anywhere;
   `launch-7.sh` kills the app 0.5 s after `--- end`/`--- failed` (`:731-732`), and **no frozen plan waits
   for owner input**; `lifecycle-close` prints `--- awaiting close` and returns, so `--- end` follows within
   the settle; `foreground-activate` scripts three activations (open, away to Finder, self), each followed by
   a 3 s hold.
2. **The foreground case, six launches** (`G5-01` … `G5-06`, reading §2). Two attempts did not cover the
   window (`G5-01`: the app on the other display; `G5-03`: the click took focus only), one was not covered
   (`G5-05`, kept as the visible control), and three read something: `G5-02` (events and their order),
   `G5-04` (11 s occluded, no click), `G5-06` (the owner's Dock click).
3. **⌘Q** (`G5-07`, reading §3), by the owner.
4. **The visible re-takes** (`G5-08` … `G5-17`, and `G5-18`/`19` for the ES row mark), no owner action;
   28 page-snapshot pairs compared against the driven twins (reading §4).
5. **The visual judgements** in two rounds of captures opened in Preview (reading §5). After the owner's
   fourth mid-turn statement, the orchestrator read the remaining captures itself; those readings are
   labelled as a model's.
6. **Not run:** the input rows and the copy rows (reading §6).

---

## 3. Acceptance, clause by clause

Quoted verbatim from the record's §2 *2d-7-9*.

1. **"The three visibility conditions are printed at each claim."** **Met, with the gaps stated.** Every
   launch: preflight and `lock-at-end` both `unlocked`. Captures: `-l` window captures in `G5-03` … `G5-06`
   and `G5-08` … `G5-19`; **none in `G5-01`, `G5-02` and `G5-07`** (the foreground-activate and
   lifecycle-close plans take none), so no claim from those three is visual. `visibility=` is quoted at
   each beat or event claimed. Where a condition failed at a capture it is said (`G5-04`/`G5-06` captures
   requested while `visibility=hidden`, reading §2.4, §2.6). The disabled-control look is on a 2d-7-8 page
   snapshot and is **not** a visible claim (reading §5.3).
2. **"Every G5 row is answered, or named unread with its reason."** **Met** by §3a's table; the handed
   rows by §3b.
3. **"Each owner statement is recorded as the owner's."** **Met.** Reading §2-§5 quotes each verbatim from
   the session log, the free-text ones and the answered options; §4 below lists the free-text ones.
4. **"Captures are `-l` window captures only."** **Met** for this session: every capture line reads
   `used=window`. The only non-window images looked at are the plan's WebKit page snapshots, used for the
   mechanical comparison (reading §4) and for the model's look at 2d-7-8's held state (reading §5.3), and
   each is labelled as such.

### 3a. The G5 rows, each exactly once

| # | G5 row | **Class** | Launch(es) | What was read, or what is missing |
|---|---|---|---|---|
| 1 | **Foreground**: occluded >10 s until the beats stop; the owner's Dock click; `focus`/`visibilitychange`, one task or not, drains with the Rust tally, beats resume | **read — the premise did not hold** | `G5-02`, `G5-04`, `G5-05`, `G5-06` (`G5-01`, `G5-03` not occluded) | `G5-02`: `blur` and `visibilitychange`(hidden) at the same ms (t=1924) on the owner's cover; the page ran hidden 2.8 s; no drain while hidden; the scripted `open` gave `focus` first with `visibility=hidden` (t=4690) then `visibilitychange`(visible) at t=4692, **two drains (1 → 3), not coalesced; whether the two events ran in one task is unread (the page prints no task boundary)**. `G5-04`: hidden beats 6-16 (≥10.0 s), **the beats never stopped**, `--- end` reached. `G5-06`: hidden from beat 3 to beat 11, visible and focused at beat 12 after the owner's Dock click, **after 8.8-9.8 s of occlusion, not >10 s**; drains ×5 against ×3 (`G5-04`, hidden, no click) and ×3 (`G5-05`, visible, untouched): **the click cost two drains**. "Resume" does not arise. The page-event lines at the Dock click itself are not observable (that plan prints none). |
| 2 | **Tab and default activation**, `isTrusted` printed, focus order from `document.activeElement`, Enter activates the default | **unread** | none | The frozen page prints no `isTrusted` and no `activeElement`; no plan waits for input. **Missing plan capability:** a plan that opens a surface, prints `isTrusted` and `document.activeElement` for each key event, and waits for the owner's (or the input tool's) Tab and Enter. |
| 3 | **Pointer hit-testing** on one control per family and on the status route, `isTrusted` printed | **unread** | none | **Missing plan capability:** a plan that draws each family's panel and the route, listens for `pointerdown`/`click` printing `isTrusted` and the target, and waits for a real click. The input tool (entry 20) was never exercised; Accessibility was never requested. |
| 4 | ***Copy my text*** pressed by the owner, pasted into TextEdit, the owner confirming the text | **unread** | none | **Missing plan capability:** an owner-wait plan that draws the raw editor's panel and waits for the owner's press. The authored-text copy (`external-editor`) is refused by **host state**: clipboard `types=public.file-url,public.png` (orchestrator's reading, ~18:5x), `launch-7.sh` exit 73, as at 2d-7-6-2. |
| 5 | **⌘Q** with `pagehide`/`unload` observed | **read — nothing flushed** | `G5-07` | The owner's ⌘Q ended the process (`alive-at-kill=no`); **no `--- window event=` line** for `pagehide`, `beforeunload`, `unload` or `visibilitychange`. "Not fired" and "not flushed" are indistinguishable in this instrument (`say()` is an IPC round trip). |
| 6 | **Visual judgements**, EN and ES at a stated size: C1 fold per family; the fixed disabled status control; the `SourceText` marker; the ES row mark; the close and keep labels | **read in part** | `G5-08` … `G5-13`, `G5-16` … `G5-19` (1180x728) | **Owner:** fold — the operation family's delete panel has its choice row below the fold in EN and ES ("The buttons are not visible in the captures named "deleter-*""); recovery (authored text) and raw (whole file) show theirs. Marker "Stays inline, both". ES row mark "Name intact". Labels "Clear enough". **The disabled status control: unread in a visible launch** — the only plans drawing it arm `delay` (`status-held`) or `mayHaveWritten` (`status-uncertain-route`), forbidden here (entry 17); a model's look at 2d-7-8's page snapshots saw it muted in both languages, **not a visible claim** (entry 18). |
| 7 | **One visible re-take per family**, compared against its twin | **read** | `G5-08` … `G5-14`, `G5-16` … `G5-18` | 28 page-snapshot pairs, 0 differing pixels at 2% fuzz, each 2360x1520; the metric discriminates (120755 / 138262 / 94901 on different content, reading §4). The twins were driven unlocked launches, not hidden ones. |

**Tally:** read 3 · read in part 1 · unread 3 · not run 0 (the unread rows were not launched because no
frozen plan can read them).

### 3b. The rows handed to 2d-7-9 by 2d-7-5 … 2d-7-8, each exactly once

Read today: **H14** (the `visibilitychange` arm and no drain while hidden, `G5-02`; `pagehide`/`unload`
on quit, `G5-07` — read as not flushed), **H9** (*Undo* under a held save, observed enabled on a model's look
at a 2d-7-8 page snapshot), and **H8** in its visual part (two of 2d-7-2's three visual fixes, the
`SourceText` marker and the ES row mark, confirmed by the owner's eye; the disabled status control only by a
model's look at a 2d-7-8 page snapshot, §3a row 6). Everything else stays **unread** for want of a plan (entry 37).

| # | From | Handed row | **Class** | Reason / missing plan capability |
|---|---|---|---|---|
| H1 | 2d-7-5 §8 item 1 | G1 row 4: self-save suppression in a span holding one save | **unread** | a plan with one unsubstituted `save_match` inside its own checkpointed span |
| H2 | 2d-7-5 §8 item 1 | G1 row 6a: a readable add (the in-place, possibly partial shape) | **unread** | a plan calling `probe_extra_writer` with `unreadable: false` |
| H3 | 2d-7-5 §8 item 1 | G1 row 6b: add and remove under `config/` by script | **unread** | a script-side create and remove under `config/` (a `launch-7.sh` change) |
| H4 | 2d-7-5 §8 item 1 | G1 row 7: a late old callback across a reopen, under `delay` | **unread** | a plan arming `delay` on a drain across a workspace reopen (and 2d-7-9 arms no substitution) |
| H5 | 2d-7-5 §9; 2d-7-6-1 §3a item 1 | the per-action no-write witness (S5), on all eight surfaces | **unread** | action-boundary checkpoints around each external change and a `probe_witness` right after each writer |
| H6 | 2d-7-6-1 §3a item 1 | the recovery form's retained field values | **unread** | a plan printing the recovery form's own field values |
| H7 | 2d-7-6-1 §3a item 2 | the locale switch on the authored-text and operation families and on the restore pane | **unread** | a `pickLanguage` switch with the conflict standing, then a re-read, on those surfaces |
| H8 | 2d-7-5 §8 item 4; 2d-7-6-1 §7 item 7; 2d-7-6-2 §3b; 2d-7-8 | every visual claim the driven readings left unread (G1, G2, G3, G4) | **read in part** | read: the G5 visual judgements above (the fold on three families, the marker, the ES row mark, the labels) and the 28 identical re-take pairs. Every other visual claim of those steps stays unread: it was not put to the owner (2d-7-5 said G1 owes no visual judgement). |
| H9 | 2d-7-6-1 §7 item 4 | the raw editor's *Undo* left enabled under a held save, to be looked at deliberately | **read (model's look), not exercised** | drawn dark while *Redo* and *Save* are muted, on 2d-7-8's `G4-02`/`G4-10` page snapshots (reading §5.3); whether the box accepts an undo during the save is **unread** — a plan that presses *Undo* under a `delay`-held save |
| H10 | 2d-7-6-2 §3b | the authored-text reload (both steps) | **unread** | a *Load the version on disk* press, both steps, on the editor, the creator or the recovery form |
| H11 | 2d-7-6-2 §3b | *Keep editing* / *Leave this as it is* on every family | **unread** | a press of each on each family, with the panel's and surface's state read after |
| H12 | 2d-7-6-2 §3b; entry 20 | copy on authored text, and raw's *Copy my text* under a real gesture | **unread** | = §3a row 4 (owner-wait plan; host clipboard) |
| H13 | 2d-7-6-2 §3b | the recovery form's own choices | **unread** | a plan pressing the recovery form's choices |
| H14 | 2d-7-8 §3 row 14 | the `visibilitychange` arm, the hidden-state refusal, `pagehide`/`unload` on quit | **read in part** | the arm read (`G5-02`: fired on hide and on show, one drain on show, none on hide); `pagehide`/`unload` read as no line (`G5-07`); **the hidden-state refusal unread** — no plan attempts an action while hidden and prints its answer |
| H15 | 2d-7-7 §3b | R38's panel/refresh half for all fifteen fixtures | **unread** | fifteen successor fixtures and a plan that writes one by name, then reads the refresh and the panel; the owner did not ask to see a real external edit of a fixture |
| H16 | 2d-7-8 §3 row 1 | the retry enabled and pressed after `probe_lock_other`, then restored | **unread** | a probe command restoring the file's mode while the app runs, and a plan pressing the retry (`G5-18`/`19` re-drew the lock half only) |
| H17 | 2d-7-8 §3 row 2 | `stale` from a `Named` pending row | **unread** | a plan writing a path the file list names while its row is pending |
| H18 | 2d-7-8 §3 row 3 | six panels' acknowledgements | **unread** | `mayHaveWritten` armed on those six surfaces' write commands (and 2d-7-9 arms none) |
| H19 | 2d-7-8 §3 row 4 | a refused acknowledgement press | **unread** | a plan disabling an acknowledgement and pressing it |
| H20 | 2d-7-8 §3 row 5 | empty-workspace retention | **unread** | a remover for `match/conflict.yml` and a plan removing both match files |
| H21 | 2d-7-8 §3 row 6 | `projectionReplaced` reactivity | **unread** | a plan replacing the projection under a registered origin |
| H22 | 2d-7-8 §3 row 7 | the outlived route acknowledgement and its exits note | **unread** | a held-answer plan leaving a route origin standing, then replacing the projection |
| H23 | 2d-7-8 §3 row 8 | `pathDrift.changed` | **unread** | a writer changing a path the window never named (`G5-14`/`15` re-drew `unreadable`, `removed`) |
| H24 | 2d-7-8 §3 row 9 | the surface notes `observationExit` and `holdEnded` | **unread** | a plan disabling a surface's acknowledgement by `projectionReplaced`/`superseded` or `holdMoved` |
| H25 | 2d-7-8 §3 row 10 | `noTransport` | **unread** | a substitution removing the transport before registration |
| H26 | 2d-7-8 §3 row 13 | 9b-3 §6 item 1 and its §8 recheck | **unread** | a `delay` on the automatic read with a `mayHaveWritten` save inside it, and a failing re-adoption `get_document` |

**Substitutions (entry 17).** None was armed in any G5 launch (`keepalive=off` on every plan line; no
`--- armed` or `--- substituted` line). The plans that could not be used because they arm one:
`status-held` (`delay`), the `status-uncertain-*` plans (`mayHaveWritten`),
`status-registration` (`listenRefused`), `status-not-watched` (`epochZero`) and `status-lost-history`
(`discardOnce`). That is why the fixed disabled status control has no visible launch.

---

## 4. The owner's statements, verbatim

Free text, in the order given (answered options are quoted at their rows in the reading):

1. "The finder window was on Display 1, but espansoConfig launched on display 2" (after `G5-01`)
2. "In front of the fullscreen iTerm2 window, I must say" (follow-up)
3. "iTerm2 is now on Display 2, covering the whole screen. If I click here to tell you that I'm ready, this
   becomes the active window. Does not iTerm2 covering the screen work for your test?" (before `G5-02`)
4. "I don't know why you're spending so much time, effort and tokens in checking default macOS window
   behaviour." (after `G5-07`)
5. "The buttons are not visible in the captures named "deleter-*"" (round 1)
6. "I only  see four captures now." (round 2)
7. "This doesn't make any sense. Why don't you check by yourself reading the content of the screen
   captures?" (on the disabled-control snapshots)

Answered options: "Ready"; "Covered" (`G5-02`); "Covered" and "Window on display 1" (`G5-03`); "Covered,
display 2" (`G5-04`); "Not covered" and "Retry once" (`G5-05`); "Done as described" (`G5-06`); "Pressed ⌘Q"
(`G5-07`); "Visual judgements (Recommended)" (the next step after `G5-07`); "Cut off on some" (EN) and "Cut
off on some" (ES); "Clear enough"; "Stays inline, both"; "Name intact".

---

## 5. Gates (instrument present)

Each run alone; exit statuses from the tool.

| Command | Exit | Figure |
|---|---|---|
| `/private/tmp/2d7-6-1-hashcheck.sh` (before) | 0 | `summary ok=18 diff=0` |
| `cargo fmt --check` | 0 | no output |
| `cargo clippy --workspace --all-targets -- -D warnings` (`/private/tmp/2d7-9-clippy.log`) | 0 | — |
| `cargo test --workspace -- --test-threads=1 > /private/tmp/2d7-9-cargo.log 2>&1` | 0 | 26 `test result: ok` lines, **1330** passed, no non-zero `failed` |
| `npm run check` (`/private/tmp/2d7-9-check.log`) | 0 | **462** files, 0 errors, 0 warnings |
| `npm test` (`/private/tmp/2d7-9-vitest.log`) | 0 | 72 files, **3547** tests |
| `npm run build` (`/private/tmp/2d7-9-build.log`) | 0 | **201** modules |
| server-only oracle `rg -c '\$\$payload\|head_payload\|push_element' dist/assets/index-*.js` | — | no output: absent |
| client-only oracle `rg -c 'window\.__svelte\|svelte-trusted-html' dist/assets/index-*.js` | 0 | `2` |
| `/private/tmp/2d7-6-1-hashcheck.sh` (after) | 0 | `summary ok=18 diff=0`, binary `53d84fb2…` (`/private/tmp/2d7-9-hashes-end.txt`) |
| `git diff --stat src-tauri/src/main.rs src/main.ts` | 0 | `5 insertions(+), 1 deletion(-)` |

Rung **`1330 / 462 / 3547 / 201`**, unchanged. `git status --short --untracked-files=all`: the four instrument paths, `PROGRESS.json` (the orchestrator's, untouched here), this step's two records, and `docs/reviews/phase-2d-7-9.brief.md` (untracked, not written by this worker; the orchestrator's review brief).

---

## 6. Deviations

1. **The foreground row was not read as written.** No occlusion stopped the beats (`G5-04`: ≥10.0 s
   hidden, 16 of 16 beats), so "until the beats stop" never happened; and the owner's Dock click in `G5-06`
   came after 8.8-9.8 s, not >10 s. The row is answered for what happened, not re-worded.
2. **The Dock-click reading used `external-restore`**, which prints no page-event lines; the event order
   is taken from `G5-02`, where the scripted activation, not the owner's click, ended the occlusion.
3. **Correction of the session log's window size.** The log gives 1080x728 for the visual judgements and
   for every launch but `G5-03`. The launch files show **1180x728 for `G5-03` and for all of `G5-08` …
   `G5-19`** (1180x760 window captures, 2360x1520 pixels), and 1080x728 only for `G5-01`, `-02`, `-04`,
   `-05`, `-06`, `-07`. This record states 1180x728 for the judgements. `G5-03`'s window also narrowed to
   1080 during the launch.
4. **Smaller corrections of the log**, each from the launch files: `G5-04` started 18:29:39.414 and `G5-05`
   18:30:56.443; `G5-04`'s first two captures were requested while visible, not all four while hidden
   (`G5-06`: the first visible, three hidden); `G5-06`'s occlusion was 8.8-9.8 s (the drains at t=11833
   and t=11841 place its end), where the log gives 8.0-10.0 s; the discrimination figures are this
   worker's re-run (reading §4).
5. **"Hidden twin" is the brief's term, not the twins' state.** The 2d-7-6-2 and 2d-7-8 twins were driven
   launches in an unlocked session with every beat visible; the comparison is owner-present against
   unattended.
6. **The disabled status control** could not be judged on a visible launch (entry 17 forbids the
   substitutions that draw it); the look recorded is a model's, on 2d-7-8's page snapshots.

---

## 7. Open items for 2d-7-10 (not fixed here, `CLAUDE.md` §7)

1. **The delete panel's choice row is below the fold** at 1180x728 in EN and ES (owner). Measured, never
   "fixed" in 2d-7 (entry 26); a ruling for a later phase.
2. **The delete panel's two opening paragraphs overlap** (a model's look): the observation sentence and
   the "changed on disk while this panel was open" sentence say the same thing. Wording, so no change in
   2d-7 (entry 26).
3. **The ES row count wraps under the file name** (`G5-19`, a model's look corroborating the owner's "Name
   intact"): the name is whole, the row grows taller. Layout, for a later phase.
4. ***Undo* enabled under a held save** (2d-7-6-1 §7 item 4; H9): seen drawn enabled; not exercised.
   The same look shows *Stop editing* dark under the hold, where 2d-7-6-1 §7 item 4 recorded it disabled in
   the DOM: whether a disabled control is drawn muted there is for 2d-7-10 to reconcile, not a claim here.
5. **The foreground row's premise**, for the consolidation: an occluded page holding by IPC round trips
   (`hold()` → `pause` → invoke) does not stop; the beats continue for ≥10 s hidden. The occlusion-stop
   host fact in `CLAUDE.md` §6 concerns `setTimeout` and is neither confirmed nor refuted here.
6. **Each activation's drain cost, measured**: one drain per `focus` and one per `visibilitychange`
   (visible), none on `blur` or on hiding (`G5-01`, `G5-02`, `G5-03`, `G5-06`). For the record's §7 row
   "Each activation costs one drain": it costs one per event, so two when the window was also hidden.
7. **The unread rows** — §3a rows 2, 3, 4 and the disabled status control in a visible launch; §3b's
   unread rows, each with its missing capability — for 2d-7-10's unread-row inventory.
8. **The copy row's host-clipboard refusal**: the clipboard held `types=public.file-url,public.png`
   (`changeCount=262`), so `external-editor` would exit 73. A later run needs the owner's clipboard
   cleared or holding plain text.
9. **Scratch for 2d-8's list:** `launches/G5-01` … `G5-19` and their ledger lines;
   `~/Library/{WebKit,Caches}/cc.carpio.espansoConfig.probe.G5-*`; `/private/tmp/2d7-9-*` (hash records
   and gate logs).

---

## 8. Handoff

Same instrument, same binary, same harness (§1). 2d-7-9 closes under entry 37 with its rows classed
above. The next step is **2d-7-10**, the consolidation, which may now run driven (entry 21).
