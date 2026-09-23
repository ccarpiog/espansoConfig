# Phase 2d-6-10 — the narrow foreground reading

**Date:** 2026-09-23.
**Phase:** 2d-6-10, the foreground fallback ([`2d-6-split-notes.md`](2d-6-split-notes.md) §2, the
*2d-6-10 — foreground fallback* block; §3 entries 33 and 38).
**Instrument:** the harness `/private/tmp/espansoconfig-harness-2d-6-6c-2/`, with one new launch
script (§2).
**Binary for both launches** (`F10-01`, `F10-02`):
`219b78a5654824e1228ed87a87a77772e67539769bea7e6646b1721e124be30e`, built from this phase's tree
with `src/probe.ts` at `cba6c61a…` and `src-tauri/src/probe.rs` unchanged at `d2f6681d…`.

**In short.** The shipped bundle carries the DOM foreground source: a `focus` event dispatched on
the real window issued exactly one `drain_external_changes`. **The host was never seen emitting a
foreground signal.** The screen was locked for the whole reading. Three activation requests from
outside the process each left Finder frontmost, and the page reported no `focus`, `blur` or
`visibilitychange` and `hasFocus=false visibility=hidden` throughout. So this reading does **not**
show that bringing the application forward requests a drain. It shows that the wiring is live in the
real window, and that nothing drains without a signal.

---

## 1. What the filesystem showed when this phase began

- The four instrument paths were present, and `git diff --stat src-tauri/src/main.rs src/main.ts`
  read `5 insertions(+), 1 deletion(-)`. It reads the same at the end.
- `src/probe.ts` was `593bfde4…` (9c's last). A copy is kept at `/private/tmp/10-probe.ts.orig`.
- `CGSSessionScreenIsLocked` was `true` (`ioreg -n Root -d1`), and Finder was the frontmost
  process.

## 2. What changed in the harness and the instrument (never committed; 2d-8 deletes both)

- **`src/probe.ts`** (`593bfde4…` → `cba6c61a…`) gained one case, `foreground-activate`, and three
  helpers: `reportForeground`, `requestActivation` and `foregroundActivatePlan`. `armForPlan` starts
  the keep-alive for `foreground-*` plans as it does for `status-*`. The case:
  1. adds its own `focus` and `blur` listeners on `window` and a `visibilitychange` listener on
     `document`, each printing a `--- page-event` line with `hasFocus`, `visibilityState` and the
     drain count;
  2. opens and settles (`openAndSettle`);
  3. **control:** holds 3 s with nothing asked of the host, then reports;
  4. prints `--- activate open`, `--- activate away` and `--- activate self` in turn, holding 3 s
     after each and then reporting;
  5. dispatches a **synthetic** `focus` event on `window` from inside the page, holds 1.5 s, then
     reports.
- **`src-tauri/src/probe.rs`**: unchanged.
- **Harness:** `launch-10.sh` is a copy of `launch-9c.sh`. It accepts only
  `foreground-activate:(en|es)` and answers each `--- activate <method>` line once:
  - `open`: `open "$APP"` on the running bundle;
  - `away`: `osascript` activates Finder;
  - `self`: `osascript` tells System Events to make the app's process frontmost.

  After each one it writes the frontmost process's pid to `launch.txt`.

Both launches opened over **hard R0** (`hard-r0.yml`, `a569b4d9…`), the ruling-38 hard fixture
of 9c §2.3. Nothing in this reading depends on the fixture's shape; it is there because ruling 38
asks for it.

## 3. The launch recipe

```sh
npm run build                                            # 201 modules
touch src-tauri/build.rs
cargo build -p espansoconfig --features custom-protocol
/private/tmp/espansoconfig-harness-2d-6-6c-2/launch-10.sh foreground-activate:en F10-01
/private/tmp/espansoconfig-harness-2d-6-6c-2/launch-10.sh foreground-activate:es F10-02
```

## 4. The launches

| Launch | Plan | `end`/`failed`/`MISMATCH` | `probe.err` | Tree diff | `home-files` |
|---|---|---|---|---|---|
| `F10-01` | `foreground-activate:en` | 1/0/0 | 0 | none | 0 |
| `F10-02` | `foreground-activate:es` | 1/0/0 | 0 | none | 0 |

Both transcripts read the same, step by step. The figures below are `F10-01`'s, with `F10-02`'s
where they differ.

| Step | Transcript | Frontmost pid after (`launch.txt`) |
|---|---|---|
| open settled | `drains=1 hasFocus=false visibility=hidden t=1546ms` | — |
| control, 3 s later | `drains=1 … t=4548ms` | — |
| `activate open` | `drains=1 … hasFocus=false visibility=hidden` | 1289 (Finder) |
| `activate away` | `drains=1 …` | 1289 (Finder) |
| `activate self` | `drains=1 …` | 1289 (Finder) |
| synthetic `focus` | `--- page-event focus … drains=1 t=13555ms`, then `--- ipc #10 drain_external_changes args={"afterSequence":0} -> ok … t=13559ms`, then `drains=2` | — |

- **No `--- page-event` line appeared for any of the three activations**, in either launch. The only
  one is the synthetic `focus`.
- The application's own first drain (`#9`) is the registration-and-open drain every launch issues.
  The second drain (`#10`) followed the synthetic `focus` 4 ms later. It is the only drain issued
  after the open in either launch.
- The `--- drains end` line reads `count=2`, and the command totals hold nothing unexpected:
  `drain_external_changes×2`, one `plugin:event|listen`, one `open_workspace`, and no write
  command.

## 5. What this shows, and what it does not

**Shown.**
- The bundle built from this tree carries `createDomForegroundSource(document, window)` and not
  the inert source. The inert source would have ignored the synthetic `focus`; this one issued one
  drain within one turn of the event.
- No drain is issued without a signal. Nothing drained in the 3 s control hold, nor in the 9 s
  across the three activation attempts.

**Not shown, and why.**
- **That bringing the application to the foreground requests a drain.** The screen was locked
  (`CGSSessionScreenIsLocked=true`). None of the three activation routes made the app frontmost:
  Finder stayed frontmost after each. With no activation, the host emitted nothing, so there was
  nothing for the source to hear. **Whether WKWebView emits `focus` or `visibilitychange` on a real
  foregrounding of this app is unread.** Entry 33 already says that no mounted case can establish
  it, and neither can this reading.
- **A wake from the occlusion stop.** The page ran throughout only because the keep-alive asked
  WebKit for a snapshot about once a second (9c §2.2). Without it, a hidden window's timers stop
  about six seconds after launch (`CLAUDE.md` §6, *Window readings*). This reading did not observe
  a stopped page being resumed by a foreground signal. It did not try, because no foreground signal
  arrived. **Resume and wake delivery stay unread**, as ruling 38 says a reading must leave them.
- The `visibilitychange` arm, and the hidden-state refusal, are not exercised in this window at all.
  The mounted cases and the adapter suite are their only evidence.

## 6. Departures from ruling 38

Ruling 38 asks for a reading that reuses the harness and `lifecycle-delivery`, touches none of the
four instrument paths, inspects a **visible** window in EN and ES, and includes one hard fixture.
This reading departs from it in three ways, as 8c and 9c did:
1. **Its own plan, not `lifecycle-delivery`.** That plan has no step that brings the window
   forward.
2. **`src/probe.ts` was extended** (§2). The `main.rs`/`main.ts` hook diff is unchanged, and
   `probe.rs` is unchanged.
3. **The window was not visible.** The screen was locked. No person looked at a window, and no
   screen capture or WebKit snapshot was read. The claims rest on the transcripts alone, and nothing
   drawn is claimed.

It launched in EN and ES, and over the hard fixture. **A visible-window foreground reading remains
owed**, and it needs an unlocked session: bring the app forward by hand or by `osascript`, and read
the `--- page-event` and `drain_external_changes` lines. 9c's open item 7 gives 2d-7 as the natural
owner.

## 7. Privacy

Only synthetic fixtures were used. The real configuration was never read, copied or launched
against.
