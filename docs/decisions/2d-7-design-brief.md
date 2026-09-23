# Design consult brief — Phase 2d-7, the reviewed temporary instrument and the bilingual WKWebView reading

_Written 2026-09-23, after 2d-6 closed and before any line of 2d-7 exists, so the rulings can be read against
what was asked. The shape is `docs/decisions/2d-6-design-brief.md`'s: bounds named to the consultant rather
than hidden._

## 1. Operating conditions — read these first

- **Do NOT use web search and do NOT fetch URLs.** Everything you need is in this repository and in the
  harness tree named below. **Root:** `/Users/ccarpio/Developer/Utils/espansoConfig`. **Branch:** `main` — a
  Rust workspace (`crates/`, `src-tauri/`) plus a Svelte 5 / Tauri v2 frontend (`src/`).
- **The working tree is deliberately not clean, and this time the dirt is the subject.** `git status --short`
  shows four uncommitted instrument paths — `M src-tauri/src/main.rs` and `M src/main.ts` (two hook lines
  each; `git diff --stat` over the pair is `5 insertions(+), 1 deletion(-)`), `?? src-tauri/src/probe.rs` and
  `?? src/probe.ts` — and a modified `PROGRESS.json`. They are the temporary window-reading instrument
  (`CLAUDE.md` §6, *Window readings*; `PROGRESS.md` *Next action*, "READ FIRST"). **Read them in full; this
  consult rules on what happens to them.** Do not edit, stage, stash or revert them.
- **The harness lives outside the repository**, at `/private/tmp/espansoconfig-harness-2d-6-6c-2/`
  (`launch.sh`, `launch-7c.sh`, `launch-8c.sh`, `launch-9c.sh`, `launch-10.sh`, `run-9c.sh`, `fixtures/`,
  `launches/`, `tools/`). You may read it. Every fixture in it is synthetic; nothing in it may be quoted as
  if it were configuration content, and **the gitignored real corpus
  (`crates/espansoconfig-core/tests/corpus/real/`) must not be opened, quoted or proposed as a launch input**
  (`CLAUDE.md` §1).
- **Read freely. The workspace may be mounted read-only and you may be unable to write any file. That is
  expected and it must not affect your verdict** — **your final message IS the deliverable**, captured
  verbatim by the caller into `docs/reviews/phase-2d-7-design.md`. Do not try to write it, and do not tell
  the caller to run anything to get it.
- **Do not run `cargo`, `npm`, or any launch.** The Rust gate is only authoritative serially on this host,
  and a launch would add bundles to the harness tree. A sandbox limit or an unrunnable gate is not a finding
  and not a reason to hedge: say in one line what you could not verify, and rule anyway. This is an
  adversarial **design consult**, not a review: be decisive.
- **Provider.** Codex is out of quota until 2026-09-26 19:14 (`PROGRESS.md` *Next action*, item 2 of the
  consult procedure). Whoever you are, the orchestrator records the provider beside your reply.

## 2. The rules that dominate every design here

Read `CLAUDE.md` at the root — all of it — before ruling, and **§6 *Window readings* (`CLAUDE.md:228-237`)
and §7 (`:239`) twice**.

1. **A record claiming a guarantee the code does not give is this project's worst defect class.** For an
   instrument this means: a transcript line, a count or a snapshot proves only what it measured, and every
   reading states what it could not see. A green suite is not a screen, and a WebKit snapshot of a hidden page
   is not a person looking at a visible window.
2. **The review policy is the autoclaude workflow's, and `CLAUDE.md` §7 adds nothing to it: one adversarial
   review per phase; blockers fixed and verification re-run; the phase closes.** A fix is not owed a review;
   no phase is created to re-review a fix; no phase is named as a letter appended to its parent; a
   corrective phase exists only for substantial new work with its own acceptance criteria. This matters more
   here than anywhere: the last *instrument rebuild*, 2c-5-5a, ran **seven review rounds, none READY**, and
   was closed by the owner's explicit exception (`docs/decisions/2c-5-5a-instrument-rebuild.md` §16). "Review
   the instrument" must not reintroduce that tail.
3. **`espansoconfig_core::persist::save_document` is the only entry point that may write a user's file**, the
   lock is not reentrant, there is no `force` flag, and every writing command ends in one `run_one_save`
   (`src-tauri/src/commands.rs:1830`). A command counter placed in the write path is placed next to the
   thing most dangerous to touch.
4. **The instrument is never committed** (`CLAUDE.md:235-237`): stage by path, never `src-tauri/src/` as a
   directory, never `git stash`. 2d-8 deletes it. Whether 2d-7 may change that rule for its own duration is
   Q1, not an assumption.
5. **Privacy.** Synthetic fixtures only; a real-config file may be named and counted, never quoted
   (`CLAUDE.md` §1). R38 asks for *hard fixture shapes*, not for real content.

Also read: `docs/reviews/phase-2d-design.md` **Q7 item 7 (`:130`, this phase's definition)**, item 8 (`:132`,
2d-8) and Q8 (`:138`); `docs/reviews/phase-2c-5-7-removal.md:42-49` (what the next harness must inherit);
`docs/reviews/phase-2d-6-design.md` Q8 (`:235-269`, the narrow-reading rule); `docs/decisions/2d-6-split-notes.md`
§3 entry 38 (`:583-586`), §5.3, §6 item 10 and §7; **`docs/decisions/2d-6-window-readings-consolidated.md` —
all of it; §4 and §5 are this phase's inheritance**; and `PROGRESS.md` *Next action* (`:155-227`) and the
R32, R35 and R38 rows of *Open risks* (`:138`, `:140`, `:144`).

## 3. What exists today, verified by reading the files for this brief

Every range below was opened on the current tree on 2026-09-23. Counts are `rg` readings, not compiled ones.

| Fact | Where |
|---|---|
| **The hooks.** `main.rs` gains `mod probe;` and replaces `register(tauri::Builder::default())` with `probe::register_with_probe(...)`; `main.ts` imports `startProbe` and calls it after `bootstrap(...)`. `git diff --stat` over the pair: 5 insertions, 1 deletion | `src-tauri/src/main.rs` (the `mod probe;` line after `mod menu_contract;`; `fn main()`); `src/main.ts` (last two lines) |
| **`probe.rs` (975 lines) re-lists by hand every application command** — the sixteen workspace commands plus `set_menu_labels` — and then **twelve probe commands**, in one `generate_handler!`. Its own doc says a command left out "would be missing from the instrumented build alone". Nothing checks the hand list against `main.rs`'s | `src-tauri/src/probe.rs:201-244` |
| **The module header says "Eight IPC commands"**; the file registers twelve. The four 9c additions (`probe_extra_writer`, `probe_remove_other`, `probe_lock_other`, `probe_remove_extra`) are documented only at their definitions | `probe.rs:11-29`; `:836`, `:896`, `:919`, `:944` |
| **Confinement, and the four pathname rebindings disclosed as open**, "accepted, not proven": the fixture's final component, the temporary's final component, a directory above the target, a directory above the fixture. `HARNESS_ROOT` is a compile-time constant that must agree with the scripts | `probe.rs:31-58`, `:64-69` |
| **WebKit snapshots through raw Objective-C** (`takeSnapshotWithConfiguration:completionHandler:`) into the launch's `shots/`; no type checks those calls (6c-2 WR §2) | `probe.rs:540-800` (`probe_snapshot` `:726`, `probe_snapshot_state` `:794`) |
| **`cargo fmt --check` exits 1 on this tree**: ten hunks, all in `probe.rs` between lines 844 and 966 (the 9c additions). Run for this brief; the committed tree has no `probe.rs` | `2d-6-11b-notes.md` §6 item 6; this brief's own run |
| **`probe.ts` (5 210 lines).** A plan grammar `<case>[:en\|es]` and nothing wider; about forty cases dispatched from `runCase`; the language set through the picker; one transcript line per observation through `render_probe` | `src/probe.ts:5111-5121`, `:5010-5097`, `:5179-5210` |
| **The IPC recorder** wraps `window.fetch` because `__TAURI_INTERNALS__.invoke` is non-writable and non-configurable; it sees every command leaving the page as `ipc://localhost/<cmd>`, with arguments and answers | `probe.ts:146-176`, `:543-588` |
| **`PROBE_OWN_COMMANDS` names eight commands**; the four 9c probe commands are not in it, so the recorder records them as if they were application traffic (read, not measured for consequence) | `probe.ts:178-192`, `:554` |
| **The only existing "counter" is frontend and after the fact**: `commandCounts` counts recorded answers by name over `WATCHED_COMMANDS` (`reload_document`, `document_text`, `save_raw_document`). **There is no Rust-side counter** and nothing counts `save_document` calls or file writes | `probe.ts:3131-3154` |
| **No event spy.** The recorder sees the `plugin:event\|listen`/`unlisten` *commands*; nothing records a delivery of `workspace://reconciliation-ready` to the page. The wake is inferred from a drain following a write (5-7b WR §5 item 1) | `probe.ts:200-210`; `src-tauri/src/events.rs:40`, `:67` |
| **Answer substitutions (9c)**: `mayHaveWritten`, `delay`, `listenRefused`, `epochZero`, `discardOnce`, each printing `--- substituted`; the listen and the drain wait for the plan in every instrumented launch | `probe.ts:590-778`, `:4065-4079` |
| **Host workarounds**: `pause` capped at 400 round trips (~70–115 ms here); `hold(ms)` loops it; `keepAlive` requests a snapshot about once a second so a hidden page is not stopped | `probe.ts:59-66`, `:4081-4094`, `:4035-4063` |
| **The foreground case** adds DOM `focus`/`blur`/`visibilitychange` listeners in the page and asks for activation from outside | `probe.ts:4958-4998` |
| **The harness scripts** copy `target/debug/espansoconfig` into a fresh `.app` per launch name, give it its own `HOME`/`XDG_CONFIG_HOME`, and answer `--- shot` lines; exit codes 65/68/69/70; "the verdict is the reader's" | `/private/tmp/espansoconfig-harness-2d-6-6c-2/launch.sh:1-60` |

**Drift.** `phase-2d-design.md:130` cites `CLAUDE.md:488-500` for the WKWebView constraints; since the
2026-09-20 rewrite they are `CLAUDE.md:228-237`. `phase-2c-5-7-removal.md:42-49` resolves. 11a's
`workspace.svelte.ts ~4634-4645` for the `writtenHere` release is now `:4650-4661`; `observationTransitions.ts
~1203` is `markStaleWhileOurs` at `:1204`. `CLAUDE.md` §6 places `save_document` in `persist/write.rs`; it is
defined at `crates/espansoconfig-core/src/persist/save.rs:1167`.

## 4. What Phase 2d-7 is

`docs/reviews/phase-2d-design.md:130`, verbatim:

> **2d-7 — reviewed temporary instrument and bilingual WKWebView reading.** Rebuild the removed harness only
> after its own review. It inherits all four probe-writer pathname rebindings as open and accepted, never
> "closed," exactly as the removal review requires (`docs/reviews/phase-2c-5-7-removal.md:42-49`). Add a Rust
> command counter and frontend invoke/event spy so unchanged final bytes distinguish zero writes from an
> identical or transient write; otherwise the central "overwrite neither side" claim remains unobserved. Use
> short fresh-bundle launches with language selected explicitly, as required by the established WKWebView
> constraints (`CLAUDE.md:488-500`). The reading must show: real external writes under both roots; 150–300 ms
> burst coalescing and stable final content; self-save suppression; raw-view automatic refresh; every open
> write surface retaining its draft/request/candidate; compare/copy/keep/reload/recovery; `installed`,
> `alreadyThere`, `refused`, and committed-but-reprojection-failed where reachable; enabled-state plus
> disabled-state conflict timing; true Tab/default activation and representative pointer hit-testing;
> workspace reopen with a late old callback; add/remove; English and Spanish; and command count zero on every
> no-write path. Any unreachable inherited state is named as unreachable, not silently credited.

**What changed underneath it.** Item 7 was written when the harness had been *removed* (2c-5-7). It has
since been rebuilt twice without the review item 7 asks for — at 2d-5-7b under 2d-5's ruling, and at 2d-6-6c-2
under a new name — and extended by 7c, 8c, 9c and 10. Every 2d-6 reading departed from ruling 38 in the same
three ways: its own plans rather than `lifecycle-delivery`, the instrument extended, and a hidden window
under a locked screen (consolidated §3). So "rebuild after review" now meets an instrument that exists, has
grown by accretion across six phases, and has never been reviewed as a whole. Item 8 (`:132`) then deletes
"both probe sides, hooks, counters, spies, synthetic launch trees, manifests, and bundle copies", owes no new
evidence, and must carry forward every unreachable state and pathname hole.

## 5. What 2d-6 left 2d-7

### 5.1 The owed readings (`2d-6-window-readings-consolidated.md` §5.1)

1. **A visible-window reading, with ruling 38 read strictly.** No 2d-6 reading used a visible window
   (7c N §6 item 3; 8c N §5 item 3; 9c N §6 item 7).
2. **A visible-window foreground reading** (`2d-6-10-notes.md` §4 item 1): real foregrounding; whether
   WKWebView emits `focus` or `visibilitychange` and a drain follows; whether a page stopped by occlusion
   resumes on one; whether the two events arrive in one task (two tasks cost a follow-up drain).
3. **The native watcher matrix, real wake and resume delivery, and R38's window half** (`2d-6-split-notes.md`
   §6 item 10; 5-7b WR §5 items 1–2). The wake has only ever been inferred from timing.
4. **The copy under a real gesture** (6c-2 N §5 item 3) — the proof launches read `draftCopyFailed`,
   "plausibly" for lack of user activation (consolidated §4).
5. **Real input generally** — keyboard reach, focus order, a real pointer; every reading pressed controls with
   `HTMLElement.click()`. No owner named.

### 5.2 States named unread (`2d-6-window-readings-consolidated.md` §5.2, and `2d-6-9c-notes.md` §6 item 3)

From 9c: the retry enabled and pressed; `registrationFailed.noTransport`; `pathDrift.changed`; `stale` from a
`Named` pending row or behind a panel alone; the outlived route acknowledgement and its exits note; the two
surface notes; a refused acknowledgement press; six of the eight panels' acknowledgement; empty-workspace
retention in a window; 9b-3 §6 item 1's dead end and its §8 recheck; `projectionReplaced` reactivity. From
7c, 8c, 6c-2, 10 and 5-7b: the rows in consolidated §5.2 (deleter disabled under a held reading,
`supersededConflict`, `noCorrespondence`, `refusedSave` on the operation panels, the reload's `alreadyThere`
and `refused` arms, *Copy my text*, the `visibilitychange` arm, `pagehide`/`unload` on quit, the watermark's
advance, …). Most carry "none named" as owner; whether 2d-7 takes them is Q8.

### 5.3 The removal review's inheritance (`phase-2c-5-7-removal.md:42-49`)

The four pathname rebindings (open and accepted); four live-window-unreachable states (open-surface refusal,
adoption `alreadyThere`, adoption `refused`, committed-but-reprojection-failed); the enabled-state half of
conflict-moment covering; no real Tab/default keyboard activation and limited pointer evidence; **no command
counter and no invoke spy**; the fifteen corpus fixtures and the owner's configuration never exercised by the
window harness.

### 5.4 R38's window half (`PROGRESS.md:144`)

Every window reading has run on easy shapes; none of the fifteen `CLAUDE.md` §4 fixtures has been through the
harness. Narrowed at 2d-5-7b (one CRLF block-scalar fixture through *delivery*, not a drawn screen). Since then
7c, 8c and 9c drew panels over a synthetic "hard" set *shaped after* `move-block-scalar-seams.yml` plus CRLF and
lone-`\r` variants, with the corpus files not copied (7c WR §8.1; 8c WR §2; 9c WR §2.3). The consolidated
record does not call that closure, and neither does this brief.

### 5.5 The instrument's `cargo fmt --check` failure (`2d-6-11b-notes.md` §6 item 6)

`cargo fmt --check` cannot exit 0 in this working tree: ten hunks in the uncommitted `probe.rs` (§3). 11b
names 2d-7 (which reviews the instrument) or 2d-8 (which deletes it) as the closer.

### 5.6 Host facts 2d-7 inherits (consolidated §4)

The screen was locked in 6c-2, 7c, 8c and 10: `screencapture -x` gives the lock screen, `screencapture -l`
fails, so the visual evidence was WebKit's render of a hidden page. The hidden page stops a couple of seconds
after its last snapshot once more than about six seconds old (`CLAUDE.md` §6's occlusion stop); `keepAlive`
works around it. `pause` is capped. Two proof launches (`P8-09`, `P9-06`) ended with no terminal line, cause
unknown. Activation from outside the process did not foreground the app under a locked screen. LaunchServices
drops `--env` for a bundle path it thinks is running; `localStorage` follows the bundle identifier. 9c's worker
suggested adding the `pause` cap and the keep-alive to `CLAUDE.md` §6; not done.

### 5.7 The handed-on open items, and a first sort that you must rule on

The classes are this brief's reading of each item, offered so the consult can overturn them, **not
decisions**. **W** — plausibly a window or bilingual reading, so 2d-7's material. **C** — a small model or
wording corrective step that needs a ruling first; whether it belongs inside 2d-7, before its reading, or in a
separate corrective phase is Q10. **L** — plausibly 2d-8's or later.

| Item | Source | First sort | The question it poses |
|---|---|---|---|
| "Six surfaces" and similar undercounts in comments | 11b §6 item 1 | L | A comment pass: is it any 2d-7 step's, or a later phase's? |
| `matchEditor.ts:2664` names `tSupersededEvidence` as a renderer | 11b §6 item 8 | L (or C) | Same comment pass, or corrected now because it is a false caller claim (`CLAUDE.md` §5)? |
| Refusal wording repeats (9b-2's five lines; `fileChangedWhileOpen` on mover/duplicator/restore; the creator's reload warning) | 11b §6 item 2; 9b-2 §6 item 1 | C, read by W | Fix before the bilingual reading so it reads the settled wording, or read as is and record? |
| Unused accessors (`tSupersededEvidence`, `tBackupReadStep`, `rememberExternalConflict`, `noticesBesideRefusal`, `tExternalConflictNotice`, `tExternalConflictAction`) | 11b §6 item 3; 9b-2 §6 item 2 | L | A deletion phase; not 2d-7's unless a counter or spy needs them gone? |
| Close and keep labels near-synonyms in EN and ES | 11b §6 item 9 | W | 11b names "2d-7's bilingual window reading" — does a reading decide wording, or only surface it for a ruling? |
| `cargo fmt --check` fails on `probe.rs` | 11b §6 item 6 | depends on Q1 | Format it as part of the review, or leave it to 2d-8's deletion? |
| No native-speaker review of the ES dictionary (R35) | 11b §6 item 7; 9b-3 §6 item 5; `PROGRESS.md:191` (9a) | W/L | Is "bilingual WKWebView reading" a bilingual *review*? 9c says its reading was not one (9c N §6 item 6) |
| **A `stale` mark survives a `writtenHere` release** | 11a §5 item 1; `observationTransitions.ts:1204`; `workspace.svelte.ts:4650-4661` | C | Needs a ruling on `stale`'s definition while a surface is open; does it precede 2d-7's reading of `stale`? |
| **A hold begun while an automatic read is out, with a successful re-adoption, leaves `stale` with nothing to acknowledge** | 9b-3 §6 item 1 (with items 2–3) | C | "A ruling, not a patch" (9b-3). Joined with 11a item 1 — one corrective step or two? |
| Composition check blind spots (`node`-environment tests, transitive reach, computed specifiers) | 11a §5 item 3 | L | Stated in the code; any 2d-7 spy obligation here? |
| `AppShell` last-document-removal case and save-origin adoption loops EN-only (mounted) | 11a §5 item 4 | C (test-only) or W | A mounted gap: close it in a test step, or let the window reading be the ES evidence? |
| **Visible-window foreground reading** | 10 §4 item 1 | W | 2d-7 per its record |
| Every activation costs one drain; not measured | 10 §4 item 2 | W | Does 2d-7's counter measure it? |
| No window-close `dispose()` path | 10 §4 item 3; split notes §7 item 10 | L | Deferred with no phase named; does 2d-7 read quit behaviour (`pagehide`/`unload`) or leave it? |
| A disabled status control drawn like an enabled one | 9c §6 item 1 | C, read by W | Presentation fix across three components; before or after the reading? |
| A long ES row mark breaks the file name mid-word | 9c §6 item 2 | C, read by W | Same |
| 9c's unread states | 9c §6 item 3 | W | §5.2 above; Q8 |
| `P9-06` / `P8-09` stopped with no terminal line | 9c §6 item 4; 8c §4 item 5 | W (instrument) | Does the reviewed instrument have to explain or detect these? |
| Probe measurement artifact (the editor's first `SourceText` is the trigger field) | 9c §6 item 5 | W (instrument) | Review item? |
| `CLAUDE.md` §6 to gain the `pause` cap and keep-alive facts | `PROGRESS.md:183` | W/L | 2d-7's, 2d-8's, or not at all once the instrument is gone? |
| A same-bytes observation coalesces into an outlived origin; the automatic path does not ask `observationRetained` | 9b-3 §6 items 2–3 | C/L | Rulings recorded as out of scope; does the reading need them settled? |
| Stale doc sentence "Nothing draws either today" | 9b-3 §6 item 5 (listed as item 4 in `PROGRESS.md:185`) | L | Comment pass |
| The `acknowledgeSnapshot` dead end shown, not closed | 9b-2 §6 item 3 | C | A model change (a "hold ended" delivery); in scope for any 2d-7 step? |
| 9b-1 §8.3 release-path sequence judged unreachable | `PROGRESS.md:191` | W/L | Is it on the unreachable list the reading names? |
| `SourceText.svelte`'s `.invisible` marker wraps inside a file line — a false-guarantee comment | 8c §4 item 1 | C, then W | 8c: pinning it "needs a window reading or a stylesheet assertion". A corrective step 2d-7's reading then confirms? |
| The first choice row below the fold at C1 (every panel family) | 8c §4 item 2; 7c N §4 item 1; 6c-2 N §5 item 5 | W, then C | Read in a visible window at a stated size before deciding it is a defect? |
| A CRLF-only disk text is named on neither conflict panel | 8c §4 item 3; 7c N §4 item 7 | C | A deliberate wording/display decision; 2d-7's? |
| `main.rs:214-227`'s `"permissions": []` comment | split notes §6 item 8 | L | 2d-8's by record |

## 6. Constraints you may not trade away

Settled; a ruling that contradicts one is wrong, not brave. **`save_document` is the only writer of a user's
file**, and nothing an instrument adds may call `replace_file_atomically` or `replace_locked_file`, or take the
save lock re-entrantly. **No real configuration in any launch.** **The four pathname rebindings are inherited as
open and accepted, never "closed"** (`phase-2c-5-7-removal.md:43`; `probe.rs:41-54`). **One plan per launch into
a fresh bundle path; the language set through the picker on every plan** (`CLAUDE.md:230-234`). **An unreachable
state is named unread, and a mounted assertion is never credited as its screen evidence** (ruling 38). **A
reading claims only what was seen.** **`crates/espansoconfig-core` never depends on `tauri`** — an instrument
that counts inside the core would have to respect that. **§7's review policy**, above all.

---

# The questions

Answer each with a **Ruling:** line, then the reasoning, then `file:line` evidence you derived; where uncertain,
say which observation would settle it.

### Q1 — Adopt, review, rebuild, or replace the instrument; and whether any of it is committed

Item 7 says "rebuild the removed harness only after its own review". The harness exists, uncommitted, grown
across six phases (§3, §4). Rule among (a) review the existing `probe.rs`/`probe.ts`/harness as-is and adopt
what survives; (b) rebuild a smaller instrument from the review of this one, keeping only what 2d-7's reading
needs (the recorder, confinement, snapshots) and dropping per-phase plans; (c) something else. Then rule on
**commitment**: does 2d-7 keep the "never commit the probe" rule (`CLAUDE.md:235-237`) — so every gate runs
with a dirty tree and the baselines are normalized by subtraction (`PROGRESS.md` *Verification baseline*) — or
commit the instrument for 2d-7's duration and let 2d-8's deletion be a committed diff? Say how either choice
interacts with the `5 insertions(+), 1 deletion(-)` hook invariant, with the driver's
`AUTOCLAUDE_PREFLIGHT_DIRTY`, with "never `git stash`", and with **the `cargo fmt --check` failure** (§5.5): is
a formatted `probe.rs` a 2d-7 obligation, and can 2d-7's gate set be green at all under your choice?

### Q2 — What "reviewed instrument" means concretely

Say what the review reads and what it must find before the reading may start: the hand-kept command list
against `main.rs` (`probe.rs:201-244`); the stale "eight commands" header and `PROBE_OWN_COMMANDS`
(`probe.ts:178-192`); the confinement and the four disclosed rebindings; the raw Objective-C snapshot calls;
each answer substitution's honesty and whether its `--- substituted` line suffices; the plan-wait the
substitutions impose on every launch; `keepAlive` and `hold`. Say **who** reviews it and **when** — within §7's
one-review-per-phase rule, is the instrument review that phase's review, a separate step's review, or an item
in the consult record's own review? Say what stops it becoming 2c-5-5a's seven-round tail (§2 rule 2), and
what the review's acceptance is, in checkable terms.

### Q3 — The Rust command counter

Rule on **what it counts** — command invocations by name, `run_one_save` entries, `save_document` calls, commits
(`committed: true`), or bytes renamed onto a user path — and on **where it lives**: inside `probe.rs` by wrapping
the generated invoke handler (no production file touched beyond the existing hook), in `commands.rs` or
`run_one_save` (production code), or in the core (forbidden to depend on `tauri`). Say how it is read out (a
probe command? a transcript line at quit?), how it distinguishes "no write" from "an identical write" and "a
transient write", and why it cannot become a second write path or take the non-reentrant lock. State what the
type system forces and what only the reading's own discipline does.

### Q4 — The frontend invoke/event spy

The recorder already sees every command (§3) but **no event delivery**. Rule on how 2d-7 observes a
`workspace://reconciliation-ready` delivery in the page — given `__TAURI_INTERNALS__` is not wrappable
(`probe.ts:153-157`) — so that "the wake was delivered" is observed rather than inferred from a drain's timing.
Rule on how the Rust count and the page's count are reconciled, what a disagreement means, and what "command
count zero on every no-write path" (item 7) means exactly: zero of which commands, over which window of time,
on which paths.

### Q5 — Answer substitutions and constructed states

9c reached several states only by substituting answers at the transport (§3). Rule on whether 2d-7's reading
may use substitutions at all; if so, which states may be credited that way and in what words (9c's "the cause
of that state is the probe's, never the disk's", `probe.ts:593-601`); and whether a state reachable only by
substitution counts as "reached" or as "unreachable, named" under item 7's last sentence.

### Q6 — A visible window when the screen may be locked

A driven run may have the screen locked (`PROGRESS.md` "READ FIRST"); four readings did. Rule on what
"visible window" means in checkable terms (a composited `screencapture -l` image? `document.visibilityState ===
'visible'` and `hasFocus()` in the transcript? a person's eyes?), whether 2d-7 requires an **interactive, unlocked
session with the owner present** for some steps (the foreground reading, the copy under a real gesture, real Tab
and pointer — §5.1 items 2, 4, 5), and what a driven step does when it finds the screen locked: stop, fall back
to hidden-window snapshots and name the departure, or split the step. Say whether the keep-alive may be used
in a visible reading, and what the `P8-09`/`P9-06` silent stops oblige.

### Q7 — Hard fixture shapes (R38, ruling 38)

Rule on which shapes 2d-7 carries: some or all of the fifteen `CLAUDE.md` §4 fixtures copied byte-exact into the
harness (committed synthetic files, so privacy permits it; their bytes must survive the copy), or the synthetic
"hard" set 7c built after one of them, or both. Say **what closes R38's window half** — every fixture drawn on
at least one panel? the raw viewer and one conflict panel per fixture? — and what a reading over them may and may
not claim. Say whether both watched roots get a hard shape, and how a copied fixture's bytes are verified after
the launch (`tests/corpus_integrity.rs` pins the committed copies, not the harness copies).

### Q8 — The state list

Item 7's list, the removal review's four unreachable states, consolidated §5.1–§5.2, and the 9c unread list
together are longer than any reading so far. Rule on the list 2d-7 reads, grouped so each group is one
worker's; which items are **reachable** without substitution, which only with it, and which are to be named
unreachable up front; and how "burst coalescing 150–300 ms", "under both roots", "workspace reopen with a late
old callback" and "add/remove" are produced — by which writer, at which timing, with which counter reading as
the acceptance.

### Q9 — English and Spanish

Rule on what "EN and ES" requires per state: every state in both languages, or the full list in one and a
defined subset in the other; the locale switch with a surface open (entry 35); the near-synonym close/keep
labels (11b §6 item 9); the ES row-mark wrap (9c §6 item 2). Rule on whether 2d-7 is a **bilingual review** in
R35's sense or only a bilingual *reading* (9c N §6 item 6 says a reading is not a review), and, if a review, who
may perform it given no native-speaker review is scheduled.

### Q10 — The handed-on items (§5.7)

For each row of §5.7, confirm or overturn the first sort. In particular: does **the `stale`-mark pair** (11a §5
item 1 with 9b-3 §6 item 1) need its ruling — and its fix — **before** 2d-7 reads `stale` in a window, so the
reading does not record a state about to change? Is a small corrective step legitimate inside 2d-7 under §7
("a corrective phase exists only for substantial new work"), or must it be its own phase placed before 2d-7's
reading? Rule the same way for the presentation items a reading would look at (the disabled status control, the
`SourceText` marker wrap, the choice row below the fold, the CRLF-only disk text). Say which items 2d-7 must
leave alone.

### Q11 — The step cut

Name the sub-steps (`2d-7-1`, `2d-7-2`, …), **dependency-ordered**, each small enough for one worker, and for
each say (a) what it delivers, (b) what evidence it owes — machine-checkable gates, an instrument review, a
hidden-window reading, a visible-window reading, a person at the keyboard, (c) which files it may touch
(production, instrument, harness, records), (d) **its acceptance in checkable terms**, and (e) whether it can
run in a driven (possibly locked) session or needs the owner. Say which step formats or otherwise answers the
`probe.rs` `cargo fmt` failure, which step re-measures the four baselines and how the instrument's share is
subtracted, and where a corrective step from Q10 sits, if any.

### Q12 — What goes to 2d-8

Item 8 deletes the instrument and owes no evidence. Rule on what 2d-7 must leave for it: the deletion list (both
probe sides, hooks, counters, spies, the harness tree, the `/private/tmp/*-probe.*.orig` copies no record names a
deleter for — consolidated §5.4), the `main.rs:214-227` comment, the unreachable-state and pathname-hole list
carried forward, and whether a 2d-7 state left unread becomes 2d-8's or is recorded as permanently unread. Say
whether any §5.7 item is 2d-8's rather than a later phase's.

## 7. Your output contract

- **Your final message is the deliverable.** Write no file. **Use `###` for your own internal headings, never
  `##`** — one `## VERDICT`-style header of your own at the top is fine, and everything under it is `###`.
- **Open with a short ruling paragraph** — the whole verdict in one place — then answer each numbered question
  under its own `### Qn — <title>` heading, each beginning with an explicit **Ruling:** line, and **end with a
  section proposing the sub-step split** as a dependency-ordered list, each step with its acceptance.
- **Cite `file:line` for every claim about existing code**, derived by you. Where you could not verify
  something, say so plainly in one line rather than asserting it.
- **Do not quote any real-configuration content**, and do not propose a launch over the real corpus.

## 8. What this brief could not establish — its own coverage bounds

1. **One gate was run for this brief: `cargo fmt --check`** (exit 1, ten hunks, all in `probe.rs`). No other
   gate and no launch was run. Every other count in §3 (twelve probe commands, eight in `PROBE_OWN_COMMANDS`,
   about forty cases, line counts) is an `rg`/`wc` reading on 2026-09-23.
2. **§3 is a reading of one tree, not a review of the instrument.** The facts listed are what the ranges say;
   correct endpoints do not prove the brief characterized everything between them. In particular, the effect of
   the four unlisted probe commands passing through the recorder (§3) was not measured, and no claim is made
   about whether any past transcript miscounted because of it.
3. **No claim here is made about what a window does.** Every window statement is quoted from a record, and the
   records themselves say no person looked at a live window in any 2d-6 reading (consolidated §1).
4. **The consolidated record is itself a consolidation**, re-deriving no transcript; this brief inherits its
   figures unverified.
5. **§5.7's first sort is this brief's reading, not a ruling.** The questions are open; a ruling that overturns
   item 7's own scope — including "rebuild after review" — is a legitimate outcome, provided it says which record
   it overrides and why.

## 9. Anchors to read, each verified to resolve on 2026-09-23

- `docs/reviews/phase-2d-design.md:130` (item 7), `:132` (item 8), `:138` (Q8)
- `docs/reviews/phase-2c-5-7-removal.md:42-49`
- `docs/reviews/phase-2d-6-design.md:235-269` (Q8, the narrow-reading rule)
- `docs/decisions/2d-6-split-notes.md:583-586` (entry 38), §5.3 (`:801`), §6 (`:860`, item 10), §7 (`:921`)
- `docs/decisions/2d-6-window-readings-consolidated.md` §3, §4, §5
- `docs/decisions/2d-6-11b-notes.md` §6 (`:245`); `2d-6-11a-notes.md` §5 (`:159`); `2d-6-10-notes.md` §4 (`:111`);
  `2d-6-9c-notes.md` §5 (`:118`), §6 (`:141`); `2d-6-9b-3-notes.md` §6 (`:195`); `2d-6-9b-2-notes.md` §6 (`:211`);
  `2d-6-9a-notes.md` §5 (`:227`); `2d-6-8c-notes.md` §4 (`:94`)
- `docs/decisions/2d-6-9c-window-reading.md` §2 (`:62`), §3 (`:141`), §7 (`:445`);
  `2d-6-10-window-reading.md` §5 (`:95`), §6 (`:119`); `2d-6-6c-2-window-reading.md` §2 (`:37`);
  `2d-5-7b-window-reading.md` §3 (`:119`), §4.5 (`:356`), §5 (`:420`), §9 (`:541`)
- `docs/decisions/2c-5-5a-instrument-rebuild.md` §16 (`:2152`); `docs/decisions/1c-2b-2b-2-notes.md` §6.1 (`:279`)
- `CLAUDE.md:228-237` (§6 *Window readings*), `:239` (§7)
- `PROGRESS.md:144` (R38), `:140` (R35), `:138` (R32), `:155-227` (*Next action*)
- `src-tauri/src/probe.rs:11-69`, `:201-244`, `:540-800`, `:836-975`
- `src/probe.ts:146-192`, `:543-778`, `:3131-3154`, `:4035-4094`, `:5010-5210`
- `src-tauri/src/events.rs:40`, `:67`; `src-tauri/src/commands.rs:1830`;
  `crates/espansoconfig-core/src/persist/save.rs:1167`
- `src/lib/browser/observationTransitions.ts:1204`; `src/lib/browser/workspace.svelte.ts:4650-4661`
- `/private/tmp/espansoconfig-harness-2d-6-6c-2/launch.sh:1-60`
