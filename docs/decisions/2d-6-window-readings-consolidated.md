# The narrow window readings of 2d-5-7b and 2d-6, consolidated

**Date:** 2026-09-23
**Phase:** 2d-6-11b ([`2d-6-split-notes.md`](2d-6-split-notes.md) §2, the *2d-6-11* block and the
11a/11b cut under it: "the earlier narrow readings consolidated without being called the 2d-7 matrix").

**What this record is, and what it is not.**
- It is **a consolidation of existing records only**. It collects what six narrow readings say they
  read, how, over which fixtures, what they found, and what they left unread. It groups what stays
  owed in one place.
- It is **not the 2d-7 matrix**. The native watcher matrix, real wake and resume delivery and R38's
  window half are 2d-7's (`2d-6-split-notes.md` §6 item 10). The reviewed instrument and the bilingual
  WKWebView reading are 2d-7's too (`PROGRESS.md`, *The rest of the 2d consult*).
- It **makes no new window claim**. No launch was run and no snapshot was opened for this record.
  Every statement below names the record and the section it comes from. Where the records disagree
  or say nothing, this record says so. It does not fill the gap.
- It quotes no configuration content. Every fixture named here is a synthetic harness file, and each
  source record states that the real configuration was never read, copied or launched against.

**Abbreviations.** `WR` is a phase's `…-window-reading.md`; `N` is its `…-notes.md`. So *6c-2 WR §4.5*
is [`2d-6-6c-2-window-reading.md`](2d-6-6c-2-window-reading.md) §4.5. 2d-5-7b has no notes file of its
own. Its reading was owed by [`2d-5-7a-notes.md`](2d-5-7a-notes.md) §6 item 2, and its record is the
WR alone (5-7b WR §6 item 1).

**Sources:** [`2d-5-7b-window-reading.md`](2d-5-7b-window-reading.md),
[`2d-6-6c-2-window-reading.md`](2d-6-6c-2-window-reading.md) / [`-notes`](2d-6-6c-2-notes.md),
[`2d-6-7c-window-reading.md`](2d-6-7c-window-reading.md) / [`-notes`](2d-6-7c-notes.md),
[`2d-6-8c-window-reading.md`](2d-6-8c-window-reading.md) / [`-notes`](2d-6-8c-notes.md),
[`2d-6-9c-window-reading.md`](2d-6-9c-window-reading.md) / [`-notes`](2d-6-9c-notes.md),
[`2d-6-10-window-reading.md`](2d-6-10-window-reading.md) / [`-notes`](2d-6-10-notes.md), and ruling 38
in [`2d-6-split-notes.md`](2d-6-split-notes.md) §3.

---

## 1. The six readings at a glance

| Reading | Surfaces read | Languages | Proof launches (shakedowns) | Harness | How it was seen | Hard fixture | Source |
|---|---|---|---|---|---|---|---|
| **2d-5-7b** | none drawn. Registration, the open's drain, external delivery, quit, the no-plan control | EN + ES | `L01`–`L07`, `N01`–`N02` (`S01`–`S03`) | `/private/tmp/espansoconfig-harness-2d-5-7b/` | transcripts only; windows occluded, `visibility=hidden hasFocus=false` | one CRLF block-scalar R1 (`L05`) | WR header, §4.1, §5 item 4 |
| **2d-6-6c-2** | the external panels of the match editor, the creator and recovery | EN + ES | `L01`–`L06` (`S01`–`S04`) | `/private/tmp/espansoconfig-harness-2d-6-6c-2/` (new) | transcripts + WebKit snapshots of a hidden window; screen locked | none listed; §2's six fixtures are plain | WR header, §2, §4, §5 |
| **2d-6-7c** | the external panels of the deleter, the mover and the duplicator | EN + ES | `P01`–`P08`, `H02`–`H05` (`T01`–`T05`, `H01`) | 6c-2's, widened | transcripts + WebKit snapshots; screen locked | `hard` and `hardcrlf`, mover only (fix round) | WR header, §4, §8 |
| **2d-6-8c** | the external panels of the raw editor and restore, the viewer, the save arm | EN + ES | `P8-01`–`P8-21` (`S8-01`–`S8-11`); `P8-09` not counted | 6c-2's, widened | transcripts + WebKit snapshots; screen locked | `hard`, `hardcrlf`, `hardcr` on every plan | WR header, §2, §4, §9 |
| **2d-6-9c** | the reconciliation status: route, pane block, sidebar rows, banners, two panels' snapshot acknowledgement | EN + ES | `P9-01`–`P9-23` (`S9-01`–`S9-20`); `P9-06` not counted | 6c-2's, widened | transcripts + WebKit snapshots of a hidden window; several states put in place by answer substitution | `hard` R0 → R1 on every plan | WR header, §2, §4 |
| **2d-6-10** | none drawn. The DOM foreground source's wiring | EN + ES | `F10-01`, `F10-02` | 6c-2's, one new script | transcripts only; screen locked; no snapshot read | `hard` R0 | WR §1–§4, §6 |

Across all six: a fresh bundle path and one plan per launch, and the language set through the picker
on every plan launch (5-7b WR §4; 6c-2 WR §3; 7c WR §3; 8c WR §3; 9c WR §3). `HOME` and
`XDG_CONFIG_HOME` pointed into each launch's own tree (5-7b WR §7; 6c-2 WR §2; 7c WR §2; 8c WR §2).
Controls were pressed with `HTMLElement.click()`, never with real input (6c-2 WR §5; 7c WR §5; 8c WR §6;
9c WR §7). **No person looked at a live window in any of them** (6c-2 WR header; 7c WR header; 8c WR
header; 9c WR header; 10 WR §6 item 3). 5-7b records every window as occluded (WR §5 item 4).

---

## 2. Each reading

### 2.1 2d-5-7b — the harness rebuild and the lifecycle reading (2026-09-21)

| | |
|---|---|
| **Read** | Plans `lifecycle-open`, `lifecycle-delivery`, `lifecycle-delivery-hard` and `lifecycle-close`, plus two no-plan controls. What was read: registration through `plugin:event|listen`; the open's one drain; an external replacement delivered as a new drain with one `Changed` observation; an Apple Event quit (WR §4.1–§4.6). |
| **How** | An IPC recorder added to `src/probe.ts`, and `HARNESS_ROOT` moved (WR §2, §3). Transcripts only. "`HTMLElement`s were queried, not looked at", in occluded windows at 1180×728 (WR §5 item 4). The reading is bound by `2d-5-split-notes.md` §6 item 7, which predates ruling 38 (WR header). |
| **Fixtures** | Five synthetic files naming `:alpha`/`:beta`/`:gamma`. The hard one is `target-changed-crlf-block-r1.yml`: every line ending `\r\n`, and a two-line `\|` block scalar (WR §2). |
| **Found** | No production source changed (WR header). **No window-close path runs `dispose()`**: a real quit issued no `plugin:event|unlisten` (WR §4.5, §10 item 1). The review's one SHOULD-FIX, a latency figure generalised over three launches, was fixed in the record only (WR §11). |
| **Left unread** | The wake itself: a drain following a write is an inference from timing (WR §5 item 1, §10 item 2). The native matrix (§5 item 2). Anything drawn (§5 item 4). The watermark's advance (§5 item 6). Whether WKWebView fires `pagehide`/`unload` on quit (§4.5 item 3, §10 item 4). The retained bundles were not privacy-swept (§7, §10 item 5). |

### 2.2 2d-6-6c-2 — the three authored external-conflict panels (launches 00:17–00:21)

| | |
|---|---|
| **Read** | (a) The editor over a file changed on disk; (b) the creator that names no file, then naming one; (c) recovery over a file other than its host's. For each: the sentences, choices, observed revision, placement and the copy disclosure (WR §4.1–§4.5). |
| **How** | The harness was rebuilt under a new name. The instrument gained three cases, `probe_other_writer`, `probe_snapshot` and `probe_snapshot_state`; the snapshots are raw Objective-C, and "no type checks any of those calls" (WR §2). `tools/verbatim.cjs` compared the text against the dictionaries outside the app (WR §4.4). Screen captures showed the lock screen, and window captures failed (WR §4.6). The reader opened four of the sixteen proof snapshots (WR §4.6, §6). The record does not discuss ruling 38 or name a departure from it. |
| **Fixtures** | Six synthetic LF files: `base-r0`, `target-changed-r1`, `beta-removed-r1`, `other-r0`, `other-changed-r1` and `default-config` (WR §2). None of them is described as having a hard shape. |
| **Found** | Every sentence the mounted suites read was drawn verbatim (WR §4.4). The panel is revealed at the scroller's top. **The editor's and the creator's choice rows are below the fold** (0 of 23 px; 0 of 50 px in ES); the recovery form's row is visible (WR §4.5). The copy disclosure read `draftCopyFailed` in the proof launches (WR §4.1). The two carried code fixes were taken before the reading (N §2 item 1). The review's blocker was in `workspace.svelte.ts` and not a window finding (N §6). |
| **Left unread** | The save-arm host beside a recovery form. Mounted scenarios 4–6. Real input, and the copy under a real gesture (WR §5; N §5 item 3). The scroller's position before delivery (WR §4.5). The creator's reload warning, drawn while the reload is not offered, is recorded and not judged (WR §5; N §5 item 4). |

### 2.3 2d-6-7c — the operation panels' external conflicts (launches 01:53–01:58; fix round 02:08–02:10)

| | |
|---|---|
| **Read** | The deleter, the mover and the duplicator through C1 (external change), *Keep what I asked for* (`reapplied`), C2, the reload's second step, C3 superseding at that step, manual resolution, and the two-step close. Also a mover nobody touched (WR §3, §4.1–§4.7). |
| **How** | `launch-7c.sh`; `probe_fourth_writer` in `probe.rs`; four cases, and in the fix round `reportDiskText`, in `probe.ts`; `tools/verbatim-7c.cjs` (WR §2, §8.1). Hidden window, screen locked (WR §5). Snapshots opened: three of the 26 proof ones plus `P08`'s (WR §6), and one of the 16 hard ones (WR §8.5). Departures from ruling 38 are recorded in N §6: the instrument modified, its own plans rather than `lifecycle-delivery`, and a window that was not visible. |
| **Fixtures** | Plain: `base-r0`, `alpha-changed-r1`, `beta-changed-again-r2`, `beta-removed-r1` as R4 (WR §2). **Hard** (fix round): the shape of `move-block-scalar-seams.yml`, with `\|` bodies at column five, a block line that looks like a comment, a column-five comment owned by `:beta`, interior and trailing blank runs, a column-two comment owned by `:gamma`, and a `>-` folded block with a more-indented line. **Hardcrlf** is the same bytes with CRLF. The corpus files were not copied (WR §8.1). |
| **Found** | No defect (WR header). The C1 choice row is partly (EN, 14 of 23 px) or wholly (ES) below the fold, and wholly in both over the hard fixture. The second step's reveal brings the row into view (WR §4.7, §8.4). The hard disk text was drawn identical to the file. A CRLF file draws exactly as its LF twin, so the panel does not show the line-ending convention (WR §8.3; N §4 item 7). The review's finding was the missing hard fixture, answered by §8 (WR §8; N §7). |
| **Left unread** | The deleter's *Delete it* disabled under a held reading. `supersededConflict`, `noCorrespondence` and the `writeOutcomeUnknown` withholding; only `baseRevisionMoved` was read. The `refusedSave` origin on these panels. The locale switch keeping the session, entry 35 (WR §5; N §4 item 2). Over the hard fixture: the deleter, the duplicator, the untouched mover, and any send, so the seam refusals were not exercised (WR §8.4). |

### 2.4 2d-6-8c — the raw editor's and restore's external conflicts (launches 03:20–03:40)

| | |
|---|---|
| **Read** | Raw and restore through C1, a forced disabled send, the second step, supersession, the raw **reseed** and the restore **retarget** (the retargeted send wrote the candidate byte-exactly). A disk text holding `\r`, named on both panels. A language switch with the conflict standing. The viewer's guarded refresh. The restore candidate dropped and chosen again. The save arm's `refusedSave` origin through the save-race plans (WR §3, §4.1–§4.9). |
| **How** | `launch-8c.sh` seeds an owner-private backup batch. `probe.ts` gained eight cases, and `pressDisabled`, which presses once as the control stands and once with `disabled` lifted; no new backend command. `tools/verbatim-8c.cjs` (WR §2, §4). Screen locked (WR header, §6). The fix round added the C1 choice-row views, scrolled by the probe, and a list of the fourteen snapshots opened, per panel and language (WR §9.1, §9.2; N §5 item 3). N §5 records the same three departures as 7c. |
| **Fixtures** | 7c's hard, plus `hardcr-alpha-changed-r1.yml` (CRLF plus one lone `\r` inside `:alpha`'s block) and `hard-candidate.yml` / `hardcrlf-candidate.yml` as the backup entry (WR §2). |
| **Found** | No defect in 2d-6-8's rendering (WR header). **Pre-existing:** the `SourceText.svelte` carriage-return marker wraps inside a file line, which falsifies its comment (WR §5.1; N §4 item 1). The C1 choice row is below the fold on both panels in both languages (N §4 item 2). A CRLF-only disk text is named on neither panel (N §4 item 3). After a save refused under the lock, no drain followed (WR §4.9; N §4 item 4). *Later settled as deliberate backend coalescing by [`2d-6-9a-notes.md`](2d-6-9a-notes.md) §3.3.* |
| **Left unread** | Raw's notices under *Save* and restore's notice beside its refusal (`observationRetained`, `writeOutcomeUnknown`). The no-candidate reload-unavailable sentence. *Copy my text*. The reload's `alreadyThere` and `refused` arms. The locale switch beyond raw at one step (WR §6; N §5 item 4). Reseed and retarget snapshots, and every `P8-11`–`P8-17` snapshot, were not opened (WR §9.3). |

### 2.5 2d-6-9c — the reconciliation status (2026-09-23)

| | |
|---|---|
| **Read** | Ten states in EN and ES: stale, unavailable, removed, path drift, not watched, failed registration, lost history, membership reload wanted, held observation and uncertain write. Four of the five controls pressed, and the retry drawn disabled only. 9b-3's refused automatic reread and acknowledge-then-reread. The snapshot acknowledgement on the raw and match editors. A locale switch on a mounted status panel (WR header, §4; N §2). |
| **How** | `launch-9c.sh` and `run-9c.sh`. Four confined commands in `probe.rs`. In `probe.ts`: five **answer substitutions** at the transport (`mayHaveWritten`, `delay`, `listenRefused`, `epochZero`, `discardOnce`), each printing a `--- substituted` line; `hold(ms)`; and a `keepAlive` snapshot about once a second (WR §2.2; N §5). Hidden window (WR header). The snapshots opened are listed in WR §6. N §3 and §6 item 7 record three departures from ruling 38: its own plans, the instrument extended, a hidden window. |
| **Fixtures** | Every plan opens over `hard-r0.yml` and changes to `hard-alpha-changed-r1.yml`. Also `other-r0.yml` and a new neutral `extra-r0.yml`, some created unreadable (mode `0o000`) or removed by the probe (WR §2.1–§2.3). |
| **Found** | **Defect, fixed here:** the route squeezed the sidebar and the pane to no height. `.reconciliation` gained `flex-shrink: 0; max-height: 45vh; overflow-y: auto`, with a pin shown failing first (WR §5.1; N §4). Seen and not fixed: a disabled status control drawn like an enabled one, and a long ES row mark breaking the file name mid-word (WR §5.2; N §6 items 1–2). |
| **Left unread** | The retry enabled and pressed. `registrationFailed.noTransport`. `pathDrift.changed`. `stale` from a `Named` pending row, or behind a surface's panel alone. The outlived route acknowledgement and its exits note. The two surface notes and a refused acknowledgement press. Six of the eight panels' acknowledgement. 9b-3 §6 item 1 and its §8 recheck. `projectionReplaced` reactivity. A visible window, real input, wake or resume (WR §7; N §6 item 3). Empty-workspace retention in a window (N §6 item 3). |

### 2.6 2d-6-10 — the foreground reading (2026-09-23)

| | |
|---|---|
| **Read** | Whether the shipped bundle carries the DOM foreground source, and whether anything drains without a signal (WR §4, §5). |
| **How** | One case, `foreground-activate`, in `probe.ts`, and `launch-10.sh`, which answers three activation requests (`open`, Finder via `osascript`, System Events frontmost). Then a **synthetic** `focus` dispatched inside the page. Screen locked (`CGSSessionScreenIsLocked=true`). Transcripts only; "no screen capture or WebKit snapshot was read" (WR §1, §2, §6). WR §6 records three departures from ruling 38. |
| **Fixtures** | `hard-r0.yml`, carried because ruling 38 asks for one; nothing depended on its shape (WR §2). |
| **Found** | The synthetic `focus` issued exactly one drain, 4 ms later. Nothing drained in the 3 s control or across the three activation attempts. None of the attempts made the app frontmost, and the page saw no `focus`, `blur` or `visibilitychange` (WR §4, §5). No defect. |
| **Left unread** | Real foregrounding. Whether WKWebView emits `focus` or `visibilitychange` on it. A page stopped by occlusion resuming on a foreground signal. The `visibilitychange` arm and the hidden-state refusal in a window (WR §5). Whether `focus` and `visibilitychange` arrive in one task: two tasks cost a follow-up drain (N §3, *triggers coalesce*). |

---

## 3. Ruling 38, reading by reading

Ruling 38 asks a narrow reading to: reuse the harness and `lifecycle-delivery`; touch none of the four
instrument paths; inspect a **visible** window in EN and ES; read the changed panels and enabled
controls; include one hard fixture; and name an unreachable state as unread (`2d-6-split-notes.md` §3
entry 38). 2d-5-7b predates the ruling and is left out.

| Condition | 6c-2 | 7c | 8c | 9c | 10 |
|---|---|---|---|---|---|
| `lifecycle-delivery` reused | no; own cases (WR §2), no departure recorded | no (N §6 item 2) | no (N §5 item 2) | no (N §6 item 7) | no (WR §6 item 1) |
| Instrument paths untouched | no; `probe.rs` and `probe.ts` extended (WR §2) | no (N §6 item 1) | no; `probe.ts` only (N §5 item 1) | no; both (N §5) | no; `probe.ts` only (WR §6 item 2) |
| Hook diff `5 insertions(+), 1 deletion(-)` kept | yes (WR §2) | yes (N §5) | yes (WR §2) | yes (WR §2.2) | yes (WR §1) |
| Visible window | no; locked, hidden (WR §5) | no (N §6 item 3) | no (N §5 item 3) | no (N §6 item 7) | no (WR §6 item 3) |
| EN and ES | yes | yes | yes | yes | yes |
| One hard fixture | none listed (WR §2) | yes, mover only (WR §8) | yes (WR §2) | yes (WR §2.3) | yes (WR §2) |
| Unreachable states named unread | yes (WR §5) | yes (WR §5, §8.4) | yes (N §5 item 4) | yes (WR §7) | yes (WR §5) |

---

## 4. Host facts the readings recorded

These are facts about the harness and the host, not about the application. 2d-7 inherits them.

| Fact | Source |
|---|---|
| The screen was locked during 6c-2, 7c, 8c and 10. `screencapture -x` gives the lock screen or black, and `screencapture -l` answers `could not create image from window`. So the visual evidence is `probe_snapshot`'s WebKit render, not a composited window. | 6c-2 WR §1, §4.6; 7c WR header; 8c WR header; 10 WR §1 |
| `pause(ms)` is capped at 400 backend round trips, about 70–115 ms on this host. Every 8c `pause(1500)` waited a fraction of that, and none of 8c's claims rested on the length. | 9c WR §2.2; 9c N §5 |
| A hidden page stops a couple of seconds after its last snapshot request, once more than about six seconds old. A snapshot about once a second (`keepAlive`) keeps it running. This is `CLAUDE.md` §6's occlusion stop. | 9c WR §2.2; 9c N §5 |
| Two proof launches stopped with no terminal line, cause not established: `P8-09` (8c) and `P9-06` (9c; the keep-alive was running). Each was re-run and passed (`P8-17`, `P9-23`). | 8c WR §4, §6; 9c WR §4; 9c N §6 item 4 |
| Activation from outside the process (`open`, `osascript`) did not make the app frontmost under a locked screen. | 10 WR §4, §5 |
| The copy control's result differed: `draftCopied` in a shakedown about 0.8 s after launch, `draftCopyFailed` in the proof launches about 6 s after. That is "plausibly" a lack of user activation. | 6c-2 WR §4.1 |
| 9c's worker suggested adding the `pause` limit and the snapshot keep-alive to `CLAUDE.md` §6 *Window readings*. This was not done. | `PROGRESS.md` *Next action*, *Handed on by 9c* |

---

## 5. What stays unread or owed, and whose it is

"Owner" is the owner the cited record names. **"None named"** means no record names one, and this
record does not assign one.

### 5.1 Readings owed

| # | Owed | Recorded in | Owner |
|---|---|---|---|
| 1 | **A visible-window reading**, where ruling 38 is read strictly. Every 2d-6 reading used a hidden window | 7c N §6 item 3; 8c N §5 item 3; 9c N §6 item 7 | **2d-7**, the reviewed instrument and bilingual WKWebView reading |
| 2 | **A visible-window foreground reading.** In an unlocked session: real foregrounding; whether WKWebView emits `focus` or `visibilitychange`, and whether a drain follows; whether a page stopped by occlusion resumes on one; and whether the two events arrive in one task | 10 N §4 item 1, §3 (*triggers coalesce*); 10 WR §5, §6 | **2d-7** (joins 9c N §6 item 7) |
| 3 | **The native watcher matrix, real wake and resume delivery, R38's window half.** The wake has so far been inferred from timing, never observed | `2d-6-split-notes.md` §6 item 10; 5-7b WR §5 items 1–2, §9 | **2d-7** |
| 4 | **The copy under a real gesture**: press *Copy my text* and paste | 6c-2 N §5 item 3 | **2d-7** ("a reading with a person at the keyboard") |
| 5 | Real input generally: keyboard reach, focus order, a real mouse | 6c-2 WR §5; 7c WR §5; 8c WR §6 | none named; falls under item 1's reading |

### 5.2 States named unread, by reading

| From | Unread states | Owner |
|---|---|---|
| 6c-2 | save-arm host beside a recovery form's external arm; mounted scenarios 4–6 (WR §5; N §2 item 4) | none named; the mounted suites carry them |
| 7c | deleter's *Delete it* disabled under a held reading; `supersededConflict` (7b §4 item 5), `noCorrespondence`, the `writeOutcomeUnknown` withholding; `refusedSave` on operation panels; locale switch keeping the session (entry 35); deleter, duplicator, untouched mover and any send over the hard fixture (WR §5, §8.4; N §4 item 2) | none named |
| 8c | raw's notices under *Save*; restore's notice beside its refusal; the no-candidate reload-unavailable sentence; *Copy my text*; the reload's `alreadyThere` / `refused` arms; the locale switch beyond raw at one step (WR §6, §9.3; N §5 item 4) | none named; the mounted cases carry the two notices (WR §6) |
| 9c | retry enabled and pressed; `noTransport`; `pathDrift.changed`; `stale` from a `Named` pending row or behind a panel alone; the outlived route acknowledgement and its exits note; the two surface notes; a refused acknowledgement press; six of the eight panels' acknowledgement; empty-workspace retention; 9b-3 §6 item 1 and its §8 recheck; `projectionReplaced` reactivity (WR §7; N §6 item 3) | none named |
| 10 | the `visibilitychange` arm and the hidden-state refusal in a window (WR §5) | none named for these two by themselves; 10 N §4 item 1's foreground reading (§5.1 item 2, 2d-7) is the reading that would see them |
| 5-7b | whether WKWebView fires `pagehide`/`unload` on quit (WR §4.5 item 3, §10 item 4); the watermark's advance (§5 item 6) | none named |

### 5.3 Seen in a window and not fixed

| Item | Recorded in | Owner as recorded |
|---|---|---|
| Choice row below the fold at C1: the editor and creator (6c-2), the operation panels (7c), raw and restore (8c). The second step's reveal does reach its row | 6c-2 N §5 item 5; 7c N §4 item 1; 8c N §4 item 2 | "a later phase to decide"; none named |
| `SourceText.svelte`'s `.invisible` marker wraps inside a file line, which falsifies its comment | 8c WR §5.1; 8c N §4 item 1 | "recommended … as a small corrective item"; not scheduled (`PROGRESS.md`, *Open items carried from 8c*) |
| A CRLF-only disk text is named on neither conflict panel | 7c N §4 item 7; 8c N §4 item 3 | "a later deliberate decision"; none named |
| A disabled status control is drawn like an enabled one | 9c WR §5.2; 9c N §6 item 1 | "a candidate small corrective step, or 2d-6-11's" |
| A long Spanish row mark breaks the file name mid-word | 9c WR §5.2; 9c N §6 item 2 | none named |
| The creator's reload warning is drawn while the reload is not offered | 6c-2 WR §5; 6c-2 N §5 item 4 | 2d-6-11's wording review, or a later phase |
| Refusal lines repeating `fileChangedWhileOpen` (mover, duplicator, restore); ES *Dejarlo como está* collision | 7c N §4 item 4; 8c N §4 item 6 | 2d-6-11 |

### 5.4 Not a reading, carried beside them

| Item | Recorded in | Owner |
|---|---|---|
| No window-close path runs `dispose()`; the foreground listeners also go with the page | 5-7b WR §4.5, §10 item 1; 10 N §4 item 3; `2d-6-split-notes.md` §6 item 7 | none named (split notes §7 item 10 stays open) |
| Every window activation costs one drain; judged acceptable, not measured | 10 N §4 item 2 | none named |
| The instrument (`src/probe.ts`, `src-tauri/src/probe.rs`, the hook lines) and both harness trees: `/private/tmp/espansoconfig-harness-2d-5-7b/` (it had already gone by 6c-2, per 6c-2 WR §1) and `/private/tmp/espansoconfig-harness-2d-6-6c-2/`, with every script, fixture and launch added by 7c, 8c, 9c and 10 | 5-7b WR §9; 6c-2 N §5 item 6; 7c N §4 item 8; 8c N §4 item 8; 9c WR §2; 10 N §5 | **2d-8** |
| The pre-edit copies `/private/tmp/9c-probe.ts.orig`, `/private/tmp/9c-probe.rs.orig` and `/private/tmp/10-probe.ts.orig` | 9c WR §1; 10 WR §1 | no record names a deleter |

**Closed since it was recorded:** 8c N §4 item 4 (no drain after a save refused under the lock) was
diagnosed as deliberate backend coalescing, not a defect, in `2d-6-9a-notes.md` §3.3.

---

## 6. What this record does not do

It runs no launch, opens no snapshot and re-derives no transcript line. A figure quoted above is the
figure its source prints. It does not judge whether a departure from ruling 38 was justified; it
lists what each record says it did. It does not schedule any owed item; the owners in §5 are the ones
the records name. It is not the 2d-7 matrix, and nothing in it may be cited as evidence that any
unread state above behaves in a window as its mounted suite says.
