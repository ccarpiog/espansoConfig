# Phase 2d-7-9 — G5: the owner-present, unlocked-screen visible session (window reading)

**Date:** 2026-09-23.
**Spec:** [`2d-7-split-notes.md`](2d-7-split-notes.md) §2 *2d-7-9*, bound by §3 entries 18, 20, 21, 25
and 26 (and 17, 19 and 37 as cited). The G5 rows are the consult's
([`phase-2d-7-design.md`](../reviews/phase-2d-7-design.md) `:454-495`). What was done and why, the
acceptance clause by clause, every row's class, the deviations, the open items and the gates are in
[`2d-7-9-notes.md`](2d-7-9-notes.md).
**Instrument:** frozen. The four instrument paths and the fourteen harness files equal
[`2d-7-4-2-notes.md`](2d-7-4-2-notes.md) §5.3, 18 of 18, before the first launch (18:17:21, the
orchestrator's), at the start of the records (18:51:26) and after the gates (notes §1).
**Binary for every launch:** `53d84fb2f2060d03db217cd5381dbaceb884fa1fc236c99b6ce481e0adaa510b`, not
rebuilt. **Harness:** `/private/tmp/espansoconfig-harness-2d-6-6c-2/launch-7.sh`, unchanged.

**Who ran what.** The session was run from the interactive main session by the orchestrator, with the
owner at the unlocked screen (record entry 21, option (a) of the 2d-7-8 next action). The orchestrator
launched `G5-01` … `G5-19`, asked the owner each question, and kept a log of the session with every owner
statement verbatim (`…/scratchpad/g5-session.md`). This reading was written afterwards by a phase worker
from that log and from the launch directories; the worker launched nothing and addressed no one.

**Three kinds of statement appear below, and each is labelled where it is made:**
- **Owner** — the owner's own words, quoted verbatim from the session log (free text), or the option the
  owner picked from a question the orchestrator put (quoted as the option's label, with the meaning the
  orchestrator gave it).
- **Transcript** — a line in a launch's `probe.log`, `launch.txt` or `bytes.txt`, re-read for this record.
- **Model's look** — the orchestrator's (or, where said, this worker's) reading of a capture. **A model's
  look is never the owner's judgement**, and is never credited as one.

**Entry 18's three conditions, as they stood.** Every one of the nineteen launches' preflight read
`lock=unlocked rule=primary-unlocked-and-cross-check-not-locked`, and every `lock-at-end` read
`unlocked (primary-unlocked-and-cross-check-not-locked)`. Every capture in the session is a `-l` window
capture (`capture … used=window … onscreen=true`); **the foreground-activate plan (`G5-01`, `G5-02`) and
the lifecycle-close plan (`G5-07`) take no capture at all**, so the second condition is not met for any
claim in those three launches, and nothing visual is claimed from them. The third condition,
`visibility=` at the beat or event, is quoted at each claim. The conditions were observed at the sampled
instants only (the beats, one second apart, the page-event lines and the capture times), never between
them.

**No substitution and no keep-alive** was armed in any launch (entry 17, entry 18): every plan line reads
`keepalive=off`, and no `--- armed` or `--- substituted` line appears.

---

## 1. The launches

All: `launch-7.sh launch <plan> <name>`, the hard set, a fresh bundle path and identifier each
(`cc.carpio.espansoConfig.probe.G5-NN`, `lsappinfo-bundle-id` equal to it), language set through the
picker (`--- language picked=<en|es> lang=<en|es> label=ok`), `end-lines=1`, `failed-lines=0`,
`probe.err-bytes=0`, clipboard untouched (`copies=no`, `changeCount` equal before and after). **Every
launch reached `--- end`** (entry 19). No launch was voided or re-run by the worker; `G5-01`, `G5-03` and
`G5-05` were superseded by the orchestrator's next attempt at the same reading, for the reasons in §2,
and are kept as readings in their own right.

| Launch | Plan | Started | Beats | Viewport (`--- viewport`) | Beats `visibility=hidden` / `focus=no` | Terminal / `alive-at-kill` | `lock` preflight / end | `-l` captures | Drains (`--- tally end rust-app`) |
|---|---|---|---|---|---|---|---|---|---|
| `G5-01` | `foreground-activate:en` | 18:21:45.062 | 17 | 1080x728 | 0 / 3 | `--- end` / yes | unlocked / unlocked | none in this plan | ×3 |
| `G5-02` | `foreground-activate:en` | 18:24:50.040 | 17 | 1080x728 | 4 / 7 | `--- end` / yes | unlocked / unlocked | none in this plan | ×5 |
| `G5-03` | `external-restore:en` | 18:27:08.012 | 16 | 1180x728 | 0 / 11 | `--- end` / yes | unlocked / unlocked | 4, window 8436 (1180x760 ×3, then 1080x760) | ×4 |
| `G5-04` | `external-restore:en` | 18:29:39.414 | 16 | 1080x728 | 11 / 11 | `--- end` / yes | unlocked / unlocked | 4, window 8459, 1080x760 | ×3 |
| `G5-05` | `external-restore:en` | 18:30:56.443 | 16 | 1080x728 | 0 / 0 | `--- end` / yes | unlocked / unlocked | 4, window 8470, 1080x760 | ×3 |
| `G5-06` | `external-restore:en` | 18:34:12.569 | 16 | 1080x728 | 12 / 12 | `--- end` / yes | unlocked / unlocked | 4, window 8481, 1080x760 | ×5 |
| `G5-07` | `lifecycle-close:en` | 18:35:43.862 | 5 | 1080x728 | 0 / 0 | `--- end` / **no** | unlocked / unlocked | none in this plan | ×1 |
| `G5-08` | `external-recovery:en` | 18:37:52.681 | 8 | 1180x728 | 0 / 0 | `--- end` / yes | unlocked / unlocked | 2, window 8507, 1180x760 | ×3 |
| `G5-09` | `external-recovery:es` | 18:38:04.972 | 8 | 1180x728 | 0 / 0 | `--- end` / yes | unlocked / unlocked | 2, window 8518, 1180x760 | ×3 |
| `G5-10` | `external-deleter:en` | 18:38:17.136 | 14 | 1180x728 | 0 / 0 | `--- end` / yes | unlocked / unlocked | 4, window 8529, 1180x760 | ×4 |
| `G5-11` | `external-deleter:es` | 18:38:34.725 | 14 | 1180x728 | 0 / 0 | `--- end` / yes | unlocked / unlocked | 4, window 8540, 1180x760 | ×4 |
| `G5-12` | `external-raw:en` | 18:38:52.462 | 14 | 1180x728 | 0 / 0 | `--- end` / yes | unlocked / unlocked | 4, window 8551, 1180x760 | ×5 |
| `G5-13` | `external-raw:es` | 18:39:11.008 | 14 | 1180x728 | 0 / 0 | `--- end` / yes | unlocked / unlocked | 4, window 8562, 1180x760 | ×5 |
| `G5-14` | `status-membership:en` | 18:39:29.496 | 14 | 1180x728 | 0 / 0 | `--- end` / yes | unlocked / unlocked | 3, window 8573, 1180x760 | ×4 |
| `G5-15` | `status-membership:es` | 18:39:47.957 | 14 | 1180x728 | 0 / 0 | `--- end` / yes | unlocked / unlocked | 3, window 8584, 1180x760 | ×4 |
| `G5-16` | `external-raw-cr:en` | 18:40:06.286 | 10 | 1180x728 | 0 / 0 | `--- end` / yes | unlocked / unlocked | 2, window 8595, 1180x760 | ×3 |
| `G5-17` | `external-raw-cr:es` | 18:40:20.263 | 10 | 1180x728 | 0 / 0 | `--- end` / yes | unlocked / unlocked | 2, window 8606, 1180x760 | ×3 |
| `G5-18` | `status-unavailable:en` | 18:41:00.196 | 6 | 1180x728 | 0 / 0 | `--- end` / yes | unlocked / unlocked | 1, window 8617, 1180x760 | ×2 |
| `G5-19` | `status-unavailable:es` | 18:41:09.848 | 6 | 1180x728 | 0 / 0 | `--- end` / yes | unlocked / unlocked | 1, window 8628, 1180x760 | ×2 |

Capture tags: `G5-03` … `G5-06` `restore-c1`, `restore-c1-choices`, `restore-step`, `restore-retargeted`;
`G5-08`/`09` `recovery-panel`, `recovery-choices`; `G5-10`/`11` `deleter-c1-panel`, `deleter-step`,
`deleter-c3`, `deleter-keep2`; `G5-12`/`13` `raw-c1`, `raw-c1-choices`, `raw-step`, `raw-reseeded`;
`G5-14`/`15` `mb-unreadable`, `mb-removed`, `mb-reloaded`; `G5-16`/`17` `rawcr-c1`, `rawcr-step`;
`G5-18`/`19` `un-locked`. Each also has a WebKit page snapshot (`<tag>-webview.png`) written by the plan.

**The window size and the display varied.** The viewport was 1080x728 (dpr 2) in `G5-01`, `-02`, `-04`,
`-05`, `-06` and `-07`, and **1180x728 in `G5-03` and in all twelve re-take launches `G5-08` … `G5-19`**;
the matching window captures are 1080x760 or 1180x760 points, the title bar included, 2360x1520 pixels for
the 1180 ones. `G5-03`'s last capture came out 1080x760 while its three earlier ones were 1180x760, so its
window changed width during the launch (no `--- viewport` line was printed after the change). The launch
display varied too (§2, the owner's statements). **The visual judgements of §5 were made at the
1180x728 viewport** (1180x760 window captures); the orchestrator's session log says 1080x728 for them,
which the launch files do not bear out (notes §6, deviation 3).

---

## 2. The foreground case (`G5-01` … `G5-06`)

The record's row: "The window is occluded for more than 10 s until the beats stop, and the owner then
clicks the Dock icon", answering whether `focus` and `visibilitychange` arrive, whether in one task, what
drains follow (with the Rust tally), and whether the beats resume. The page-event listeners (`---
page-event …`) exist only in the `foreground-activate` plan; `external-restore` prints beats and drains
but no page-event line. The orchestrator used both: `foreground-activate` for the events, and the
`external-restore` plan (the longest-running unattended plan, with `-l` captures) for the owner's Dock
click. **Neither plan waits for the owner**: each runs to `--- end` on its own clock, and the script kills
the app 0.5 s after the terminal line (`launch-7.sh:731-732`).

### 2.1 `G5-01` — not an occlusion reading

**Owner** (setup question, answered "Ready"): a Finder window zoomed to fill the screen. **Owner,
verbatim, after the launch:** "The finder window was on Display 1, but espansoConfig launched on display
2". **Owner, verbatim, follow-up:** "In front of the fullscreen iTerm2 window, I must say".

So the app window was never covered. **Transcript:** all 17 beats `visibility=visible`; no
`visibilitychange` line at any point. What it reads is the scripted activations only: `opened drains=1`,
`control drains=1`; `activate open` (the app already frontmost) produced no page event and no drain
(`after-open drains=1`); `activate away` (Finder frontmost, `frontmost-pid=1289`) produced `blur` at t=7899
with `visibility=visible` and no drain; `activate self` produced `focus` at t=10950 and one drain
(`after-self drains=2`); the synthetic `focus` dispatch another (`after-synthetic drains=3`). Rust tally
`drain_external_changes×3`. No capture in this plan.

### 2.2 `G5-02` — the `visibilitychange` arm, and the order of the two events

**Owner, verbatim, before the launch:** "iTerm2 is now on Display 2, covering the whole screen. If I click
here to tell you that I'm ready, this becomes the active window. Does not iTerm2 covering the screen work
for your test?" **Owner** (cover question): "Covered" — the owner clicked iTerm2 after the app window
appeared.

**Transcript** (every line quoted from `G5-02/probe.log`):
- `--- foreground opened drains=1 hasFocus=true visibility=visible t=1550ms`.
- The owner's cover: `--- page-event blur hasFocus=false visibility=hidden drains=1 t=1924ms`, then
  `--- page-event visibilitychange hasFocus=false visibility=hidden drains=1 t=1924ms` — **the same
  millisecond, `blur` first.**
- Beats 2, 3 and 4 `visibility=hidden focus=no`: **the page kept running while hidden.**
- `--- foreground control drains=1 hasFocus=false visibility=hidden t=4550ms` — **no drain while hidden**,
  and none on the hide.
- The script's `activate open` (`frontmost-pid=95849` at 18:24:56.414) ended the occlusion:
  `--- page-event focus hasFocus=true visibility=hidden drains=1 t=4690ms` — **`focus` first, with the page
  still `hidden`** — then `--- page-event visibilitychange hasFocus=true visibility=visible drains=1
  t=4692ms`. Two drains follow, one per event: `ipc #9 drain_external_changes … t=4690ms` and `ipc #10
  drain_external_changes … t=4692ms`; `--- foreground after-open drains=3`. **1 → 3: two drains, 2 ms
  apart, one per event: not coalesced.** Whether the two events ran in one event-loop task or in two is
  **unread**: the frozen page prints timestamps, not task boundaries, and the coalescing pump clears its
  flag after a microtask (2d-6-10, mounted case 3), so two drains show only that the two signals did not
  reach the pump in one synchronous turn.
- `activate away` (Finder, on display 1): `blur` at t=7922, `visibility=visible` (nothing covered the app
  window), no drain; `activate self`: `focus` at t=10964, drains 3 → 4; synthetic `focus`: 4 → 5.
- The owner's click on iTerm2 to answer the next question: `blur` at t=16738, `visibilitychange` hidden
  at t=16753 (15 ms apart); beat 17 `visibility=hidden`.
- Rust tally `drain_external_changes×5`; `reconcile end commands=equal(except-plugin:event)`; `--- end`,
  `alive-at-kill=yes`, lock unlocked at preflight and at end.

The occlusion lasted **about 2.8 s** (t=1924 → t=4692), ended by the script's activation, not by the
owner; the page did not stop in that time. No capture in this plan.

### 2.3 `G5-03` — focus lost, the window not occluded

**Owner** (cover question): "Covered". **Owner** (what-happened question): "Window on display 1" — the app
window appeared on display 1 this time, not under iTerm2 on display 2.

**Transcript:** all 16 beats `visibility=visible`, none hidden. Focus was lost between beat 3 (t=3052,
`focus=yes`) and beat 4 (t=4052, `focus=no`), came back at beats 9-10 (`focus=yes`) and was lost again
from beat 11. The one drain outside the plan's own, `ipc #14 drain_external_changes … observations=0
t=8906ms`, sits just before beat 9's `focus=yes`, where focus returned. Rust tally
`drain_external_changes×4`. Four `-l` captures, window 8436, `onscreen=true`. The click took focus only;
the window was never occluded, so this is no occlusion reading. **The launch display varies between
launches** (`G5-02` display 2, `G5-03` display 1), so the cover had to be ready on both.

### 2.4 `G5-04` — occluded about 11 s: the beats never stopped

**Owner** (cover question): "Covered, display 2" — the app appeared on display 2 and iTerm2 covered it.

**Transcript:** beats 1-5 `visibility=visible focus=yes`; **beats 6 (t=6042) through 16 (t=16047)
`visibility=hidden focus=no`**, eleven beats, so the page was hidden for at least 10.0 s up to its last
beat (onset in (5042, 6042]). **All 16 beats arrived, one second apart, and `--- end` was reached**
(`alive-at-kill=yes`). Rust tally `drain_external_changes×3`. Four `-l` captures (window 8459,
`onscreen=true`); by the page's shot lines, `restore-c1` (t=1507) and `restore-c1-choices` (t=4142) were
requested while visible and `restore-step` (t=6784) and `restore-retargeted` (t=9969) while hidden. A `-l`
capture of an occluded window still succeeds, so entry 18's second condition held at the last two and the
third did not.

**The row's premise did not hold.** "Occluded until the beats stop" presumes the page stops under
occlusion. Here it did not: this plan holds between steps by IPC round trips (`hold()` → `pause` →
invoke), not by a timer, and an occluded page kept answering. (`CLAUDE.md` §6's fact — `setTimeout`
stopping about six seconds after launch in an occluded window — is about timers; this reading neither
confirms nor refutes it.)

### 2.5 `G5-05` — the visible, focused, untouched control

**Owner** (cover question): "Not covered" (no note). **Owner** (retry question): "Retry once".

**Transcript:** all 16 beats `visibility=visible focus=yes`; never hidden, never unfocused; Rust tally
`drain_external_changes×3`; `--- end`; four `-l` captures (window 8470). The same plan, visible and
untouched, costs three drains, as the hidden `G5-04` did.

### 2.6 `G5-06` — the owner's Dock click

**Owner** (answered): "Done as described" — the owner covered the window at once, waited about 11 s and
clicked the espansoConfig Dock icon (no different count noted).

**Transcript:**
- beat 2 t=2032 `visibility=visible focus=yes`; **beat 3 t=3032 `visibility=hidden focus=no`** … beat 11
  t=11038 hidden;
- `ipc #16 drain_external_changes … observations=0 t=11833ms` and `ipc #17 drain_external_changes …
  observations=0 t=11841ms` — two drains, 8 ms apart, between beat 11 and beat 12;
- **beat 12 t=12038 `visibility=visible focus=yes`** (the Dock click), beat 13 visible;
- beat 14 t=14038 `hidden focus=no` (the owner clicking iTerm2 to answer), beats 15-16 hidden;
- Rust tally **`drain_external_changes×5`**; `--- end`, `alive-at-kill=yes`; four `-l` captures (window
  8481), `restore-c1` (t=1526) visible and the other three (t=4206, t=6897, t=10106) hidden.

**Answers, each with its limit:**
- **The occlusion before the Dock click lasted between 8.8 and 9.8 s** (onset in (2032, 3032], end at
  the first drain, t=11833) — **less than the 10 s the row asks for**, although the owner waited "about
  11 s" by their own count.
- **Do `focus` and `visibilitychange` arrive?** Not observable in this plan, which prints no page-event
  line. The beats show both states restored at beat 12 (`visibility=visible focus=yes`). The event
  arrival and order are `G5-02`'s: `focus` first with the page still hidden, `visibilitychange` 2 ms later.
- **In one task?** **Unread.** `G5-02` gives the order (`focus` first, `visibilitychange` 2 ms later) and
  two uncoalesced drains, and `G5-06` agrees in shape (two drains 8 ms apart at the click); neither prints a
  task boundary, so this instrument does not answer the same-task question. Missing plan capability: a
  task-boundary marker beside each page-event line.
- **What drains follow?** Two, with no observations. Rust counted ×5 against ×3 for the same plan hidden
  without a click (`G5-04`) and ×3 visible and untouched (`G5-05`): **the Dock click cost two drains.**
- **Do the beats resume?** The beats never stopped (16 of 16, one second apart), so "resume" does not
  arise.

---

## 3. ⌘Q and the page-lifecycle events (`G5-07`)

**Owner** (answered): "Pressed ⌘Q" — the owner pressed ⌘Q while the app was in front, and its window
closed. **Owner, verbatim, mid-turn, after this launch:** "I don't know why you're spending so much time,
effort and tokens in checking default macOS window behaviour."

**Transcript:** the plan adds listeners for `pagehide`, `beforeunload`, `unload` and `visibilitychange`
(`src/probe.ts`, `lifecycleClosePlan()`), each writing `--- window event=<type> …` through `say()`, an IPC
round trip. `plugin:window|close` was refused (`window.close not allowed. Permissions associated with this
command: core:window:allow-close`), as the capability file intends; `--- awaiting close t=3063ms`; beats
1-5 `visibility=visible focus=yes`; `--- end`. **`alive-at-kill=no`**: the process was gone when the
script's `pkill` ran, 0.5 s after it saw the terminal line, so the owner's ⌘Q, not the script, ended it.
`probe.err` is 0 bytes. The end reconciliation reads `commands=VOID(page>rust)` because the page counted
the refused `plugin:window|close` and Rust's application tally does not; the tallies otherwise agree.

**No `--- window event=` line reached the transcript**, neither `pagehide`, `beforeunload`, `unload` nor
`visibilitychange`. **"Not fired" and "fired but not flushed before the process exited" cannot be told
apart in this instrument**, because each line needs an IPC round trip the exiting process may never
answer. No line places the ⌘Q in time; `--- end` was written, so the page was still running then. What is
read: **a real ⌘Q leaves no page-lifecycle line in this instrument.** No capture in this plan.

---

## 4. The visible re-takes against their driven twins

One C1 panel per family, EN and ES, plus the membership and unavailable status plans, re-launched with the
owner present and nothing pressed by the owner (`G5-08` … `G5-19`). Each re-take's WebKit page snapshot was
compared with its twin's, same tag: `compare -metric AE -fuzz 2% <visible>/shots/<tag>-webview.png
<twin>/shots/<tag>-webview.png null:` (ImageMagick, `/opt/homebrew/bin`), re-run by the worker for this
record.

**The twins were not hidden windows.** `G3-01/15`, `G3-03/17`, `G3-07/21`, `G3-08/22` (2d-7-6-2), `G4-06`
and `G4-01` (2d-7-8) were driven launches in an unlocked session: their preflight read `lock=unlocked`,
none of their transcripts has a `visibility=hidden` line, and their captures are `used=window`. So the
comparison is **owner-present against unattended**, not occluded against visible.

| Re-take | Twin | Tags compared | Differing pixels (2% fuzz) |
|---|---|---|---|
| `G5-08` recovery EN | `G3-01` | `recovery-panel`, `recovery-choices` | 0, 0 |
| `G5-09` recovery ES | `G3-15` | the same | 0, 0 |
| `G5-10` deleter EN | `G3-03` | `deleter-c1-panel`, `deleter-step`, `deleter-c3`, `deleter-keep2` | 0, 0, 0, 0 |
| `G5-11` deleter ES | `G3-17` | the same | 0, 0, 0, 0 |
| `G5-12` raw EN | `G3-07` | `raw-c1`, `raw-c1-choices`, `raw-step`, `raw-reseeded` | 0, 0, 0, 0 |
| `G5-13` raw ES | `G3-21` | the same | 0, 0, 0, 0 |
| `G5-16` raw-cr EN | `G3-08` | `rawcr-c1`, `rawcr-step` | 0, 0 |
| `G5-17` raw-cr ES | `G3-22` | the same | 0, 0 |
| `G5-14` membership EN | `G4-06` | `mb-unreadable`, `mb-removed`, `mb-reloaded` | 0, 0, 0 |
| `G5-18` unavailable EN | `G4-01` | `un-locked` | 0 |

**28 pairs, every one 2360x1520 on both sides, every one 0 differing pixels.** `G5-15` and `G5-19` (ES)
have no twin: 2d-7-8 ran `status-membership` and `status-unavailable` in EN only.

**The metric discriminates** (worker's re-run): `recovery-choices` against `recovery-panel` in the same
launch (`G5-08`) differ by 120755 pixels; the `deleter-c1-panel` window capture against its own page
snapshot (`G5-10`) by 138262 (the window chrome and offset); `deleter-c1-panel` EN (`G5-10`) against ES
(`G5-11`) by 94901. The orchestrator's log quotes 146716 and 104233 for the last two on tags it did not
name; this record quotes only its own re-run.

**What the comparison shows, and what it does not.** The page snapshot is WebKit's rendering of the page,
not the pixels on the screen, so identical snapshots show that the page drew the same thing with the owner
present as unattended — not that the screen showed it. What the screen showed is the `-l` window captures,
which the owner looked at (§5).

---

## 5. The visual judgements, EN and ES

All at the **1180x728 viewport** (1180x760 window captures, dpr 2), the default window the re-take launches
opened with; opened in Preview by the orchestrator for the owner. Every capture below is a `-l` window
capture from `G5-08` … `G5-19`: lock unlocked at preflight, at the capture (`lock=unlocked` on its
`capture` line) and at end, and every beat `visibility=visible focus=yes`.

### 5.1 Round 1 — the C1 fold and the labels

Captures: `G5-08`/`09` `recovery-choices-window.png` (authored text), `G5-10`/`11`
`deleter-c1-panel-window.png` (operation), `G5-12`/`13` `raw-c1-choices-window.png` (whole file).

- **Owner** (Fold, EN): "Cut off on some". **Owner** (Fold, ES): "Cut off on some".
- **Owner, verbatim, mid-turn, answering which:** "The buttons are not visible in the captures named
  "deleter-*""
- **Owner** (Labels — *Keep editing* / *Leave this as it is* / *Keep what I asked for* / *Keep my draft* /
  *Load the version on disk*): "Clear enough" — the owner can tell the choices apart in both languages.

**Read (owner):** the operation family's delete-conflict panel has its choice row **below the fold** at
1180x728 in EN and ES; the authored-text (recovery) and whole-file (raw) panels show their choice rows in
both languages. **Model's look** (the orchestrator's, at `G5-11 deleter-c1-panel-window.png`, ES,
corroborating and not credited): the panel fills the right pane, the disk-version box runs past the
window's bottom edge, a vertical scrollbar is drawn at the pane's right, and no choice button is in view;
and, as an observation rather than a defect claim, the panel's first two paragraphs say the same thing
twice (the observation sentence and the "changed on disk while this panel was open" sentence). The
labels are recorded in the owner's words and **no wording changes in 2d-7** (entry 26).

### 5.2 Round 2 — the `SourceText` marker and the ES row mark

Captures: `G5-16`/`17` `rawcr-c1-window.png`, `G5-18`/`19` `un-locked-window.png`.

- **Owner, verbatim, mid-turn**, with a screenshot of Preview's sidebar showing `rawcr-c1-window` twice
  and `un-locked-window` twice: "I only  see four captures now."
- **Owner** (CR marker): "Stays inline, both" — the marker sits inline where the carriage return is, in EN
  and ES.
- **Owner** (ES row mark): "Name intact" — the file name is whole and the ES mark sits beside or under it.
- The owner then sent a second screenshot of the same four captures, with no statement.

**Model's look** (the orchestrator's, corroborating, not credited):
- `G5-17 rawcr-c1-window.png` (ES): in *La versión del disco* the line `alpha changed on disk⟨retorno de
  carro U+000D⟩   a line after a lone…` draws the marker as an inline boxed label; the line runs past the
  box's right edge (clipped) and the marker neither wraps nor breaks it.
- `G5-19 un-locked-window.png` (ES): the row `match/other.yml` with the mark *Ilegible al observarse*
  beside it; the name is whole; the snippet count `1` wraps to a second line under the name, and the row
  grows taller (a layout observation, notes §7).

### 5.3 The fixed disabled status control — no visible launch

**Owner, verbatim, when asked to judge the disabled control on the 2d-7-8 page snapshots:** "This doesn't
make any sense. Why don't you check by yourself reading the content of the screen captures?" From there
the orchestrator read the captures itself; each such reading is a model's look.

The disabled status control is drawn only by `status-held` (arms `delay`) and `status-uncertain-route`
(arms `mayHaveWritten`). **No substitution is armed in 2d-7-9** (entry 17), so no launch of this session
draws it. **Model's look** (the orchestrator's) at 2d-7-8's page snapshots `G4-02` (EN) and `G4-10` (ES)
`hd-held-webview.png`: *Check the observed change now* / *Comprobar ahora el cambio observado* drawn with
grey label text and a light border, the same muting as the editor's disabled *Redo* / *Rehacer* and *Save
this file* / *Guardar este archivo* beside *Saving…* / *Guardando…*, while *Stop editing* / *Dejar de
editar* and *Undo* / *Deshacer* are dark; muted in both languages. **This is not a visible claim** (entry
18): it is a model's look at a WebKit page snapshot from a driven 2d-7-8 launch, not a `-l` capture taken in
this session, and not the owner's judgement. (The worker notes that 2d-7-8 also took a `-l` window capture
of the same state, `G4-02/shots/hd-held-window.png` at 17:19:55, `lock=unlocked`; it too is a driven
launch's capture, and nothing is credited from it here.)

Seen in the same look: **Undo enabled (dark) under the held save** while *Redo* and *Save* are muted —
2d-7-6-1 §7 item 4's open item, observed and not exercised.

---

## 6. What was not run, and why

- **Tab and default activation; pointer hit-testing, each with `isTrusted`.** The frozen page prints no
  `isTrusted` (`rg -i istrusted` over `src/` and `src-tauri/src/`: no hit), and no frozen plan waits for
  input; the input tool was never exercised and Accessibility was never requested.
- ***Copy my text*** (raw) under the owner's gesture, pasted into TextEdit: no frozen plan draws the raw
  panel and then waits for the owner.
- **Copy on the authored-text family** (`external-editor`): the orchestrator's clipboard reading at about
  18:5x was `changeCount=262 items=1 types=public.file-url,public.png` — more than plain text — so
  `launch-7.sh` would refuse the copy case (exit 73), as at 2d-7-6-2. Not launched; the owner was not asked
  to clear the clipboard. (That reading is in the orchestrator's log, not in a launch file.)
- **Every row handed on by 2d-7-5 … 2d-7-8 for want of a plan** stays unread for the same want (notes §3b).

## 7. What this reading does not show

- **A page stopped under occlusion, and a resume.** No occlusion here stopped the beats.
- **`focus`/`visibilitychange` at the owner's Dock click** as page-event lines: `G5-06`'s plan prints none.
- **Any page-lifecycle event on ⌘Q**, or whether one fired.
- **Real input** of any kind with `isTrusted`, and **a copy by the owner's gesture**.
- **The disabled status control in a visible launch of this session.**
- **A per-action no-write witness** (S5): the whole-launch `--- span` lines are observations only.
