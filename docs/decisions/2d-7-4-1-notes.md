# Phase 2d-7-4-1 — the instrument's harness and tools

**Date:** 2026-09-23.
**Spec:** [`2d-7-split-notes.md`](2d-7-split-notes.md) §2, the *2d-7-4* block and its addendum
"2026-09-23 — the orchestrator's cut"; bound by §3 entries 2–7, 14–16, 19, 20 and 34, read with
§5.14, §5.15 and §5.17.
**Risk:** `high`. **Touched:** the harness tree outside the repository only, plus this file. None of
the four instrument paths was modified (§0), no committed source file changed, and no real-config
file was opened, copied or quoted. **This phase's review is its own and is not the instrument
review** (§2 cutting rule); a finding about the probe files is an open item for `2d-7-4-2` (§8).

---

## 0. Provenance of the instrument paths

The four instrument paths, `shasum -a 256` at the start (08:54) and at the end of the phase:

| Path | Start | End |
|---|---|---|
| `src-tauri/src/main.rs` | `b3836a284d2c240bc8938e723e2540c5f1b1903067a5e7bcb7a7aba0eb47c3e5` | same |
| `src/main.ts` | `215f8507230ebce006d45105515efa046aa9b671c5afff5316ae0fd425dd8615` | same |
| `src-tauri/src/probe.rs` | `7db7e05865efdd72979440b6f6f6993ce8a991d228c22a06f65bd2d5861b4789` | same |
| `src/probe.ts` | `cba6c61a4958f07083d2292722a4441c9be9672c3dd955de085892cf430d22b7` | same |

`probe.rs` equals 2d-7-3's post-fix hash. `git diff --stat src-tauri/src/main.rs src/main.ts` read
`2 files changed, 5 insertions(+), 1 deletion(-)` at the start and at the end. `git status --short`
at the end lists the same six paths as at the start (`PROGRESS.json` and `2d-7-split-notes.md` were
already modified by the orchestrator before this phase) plus this file.

---

## 1. What was built, and where

The harness root is `/private/tmp/espansoconfig-harness-2d-6-6c-2/`, the one `HARNESS_ROOT` in
`probe.rs:111` names and the one entry 32 lists. **No discrepancy**: the record gives 2d-7 no other
root, and the probe writers' confinement (fixtures directly inside `<root>/fixtures`, targets under
`<root>/launches/<launch>/xdg/espanso/`) is what the new script stages into.

| Path under the harness root | What it is |
|---|---|
| `launch-7.sh` | The 2d-7 harness: seven subcommands (`preflight`, `verify`, `import`, `stage`, `write`, `burst`, `launch`) |
| `fixtures-7.manifest` | The SHA-256 manifest: 40 entries, `<sha256>  <name>  <source>` |
| `fixtures-src/synthetic-7/` | Five hand-authored synthetic sources: `config-crlf-bom-r0…r3.yml` (a config file with a BOM and CRLF endings, entry 22) and `demo-tamper-r0.yml` (used only by the tamper evidence) |
| `fixtures/` | Gained 20 imported files: the four config fixtures, the demo fixture, and the fifteen `CLAUDE.md` §4 byte-exact fixtures from the committed synthetic corpus |
| `launches-7.ledger` | One line per claimed launch name: name, bundle identifier, bundle path (or `staged-only`), time |
| `tools/post-input.swift`, `tools/post-input` | The synthesized-input tool of entry 20 — **built, not exercised on a real window** |
| `tools/lockstate.swift`, `tools/lockstate` | The lock-state reader the preflight line uses |
| `tools/pbstate.swift`, `tools/pbstate` | The pasteboard reader (change count and types, never data) and clearer the clipboard handling uses (review fix 3, §9.3) |

The five earlier scripts (`launch.sh`, `launch-7c.sh`, `launch-8c.sh`, `launch-9c.sh`,
`launch-10.sh`), `run-9c.sh` and the existing `tools/` files were not changed.

### 1.1 `launch-7.sh` — the features and how each is met

- **Lock-state preflight line, first thing in every launch** (and alone under `preflight`):
  `--- preflight lock=<locked|unlocked> rule=<…> primary="<tools/lockstate output>"
  cross-check=ioreg:IOConsoleUsers[uid=<uid>,onConsole=true].CGSSessionScreenIsLocked=<v> at=<time>`.
  The primary source is `CGSessionCopyCurrentDictionary()`'s `CGSSessionScreenIsLocked` (the key
  entry 18 names); the cross-check is the same key in `ioreg`'s `IOConsoleUsers` entry for this uid
  on the console. `unlocked` needs the primary to say unlocked **and** the cross-check not to say
  locked; unknown or disagreement is counted locked. The line is also the first line of `launch.txt`,
  the lock is re-read at every shot and at the end (`lock-at-end=` in `bytes.txt`).
- **A per-launch bundle identifier and a fresh bundle path.** The identifier is
  `cc.carpio.espansoConfig.probe.<launch-name>` (the pattern entry 32 already lists for deletion);
  the path is `launches/<name>/espansoConfig.app`. The name must be `[A-Za-z0-9-]{1,40}` because it
  becomes part of the identifier. A launch is refused early (exit 65) if the launch directory exists,
  if the identifier is in `launches-7.ledger`, or if `~/Library/WebKit/<id>` or
  `~/Library/Caches/<id>` exists; those checks are not atomic and reserve nothing. **The name is
  reserved by `mkdir <launch>` without `-p`**, the first action that creates anything, after the
  fixtures verify; of two invocations with one name exactly one gets past it, the other is refused
  (exit 65), and a reserved directory is never deleted (§9.1). The identifier the running process
  actually got is read back with `lsappinfo` and printed.
- **The clipboard is left alone unless the case copies** (`COPY_CASES`, today only
  `external-editor`). A copying case is refused (exit 73) unless the clipboard is empty or exactly
  one `public.utf8-plain-text` item, and that text is put back afterwards (an empty clipboard is
  cleared). Every launch records `tools/pbstate`'s change count and types before and after (§9.3).
- **Language through the picker.** The plan must be `<case>:en` or `<case>:es` (exit 68 otherwise);
  the page's `pickLanguage` sets it, and the summary prints the page's `--- language picked=` line.
- **Window-only captures.** A `--- shot <tag>` line is answered, after a fresh lock read, with
  `screencapture -x -o -l <window>` when unlocked, and with no capture when locked. The `launch.txt`
  line says which image is the evidence: `used=window` (`shots/<tag>-window.png`) or `used=webview
  reason=<screen-locked(…)|no-window-for-pid-…|window-capture-failed-…>` (`shots/<tag>-webview.png`,
  written by the instrument's `probe_snapshot`). The script has exactly one `screencapture` call,
  and it carries `-l` (`rg -n screencapture launch-7.sh`, §3.7). The full-screen `*-screen.png` of the
  five older scripts (entry 34) is gone.
- **Script-side writers**, for `config/` and for bursts (entry 24). Four targets and no other:
  `config/default.yml`, `match/conflict.yml`, `match/other.yml`, `match/extra.yml`, under
  `launches/<name>/xdg/espanso/`. Two modes: `replace` (a fresh `O_CREAT|O_EXCL|O_NOFOLLOW` temporary
  in the same directory, renamed over the target — an editor's atomic save; new inode) and `inplace`
  (`O_WRONLY|O_TRUNC|O_NOFOLLOW` on the existing file — the partial-file shape; same inode). Bursts:
  `fast` = exactly three writes 60 ms apart, `slow` = exactly two writes 600 ms apart, scheduled from
  one origin so the spacing does not drift, with a sleep-then-spin wait. Every write line prints its
  measured offset, duration, the fixture's SHA-256 and the target's SHA-256 read back right after
  it. Each request is appended to `<launch>/writers.log`. Reachable from the command line (`write`,
  `burst`, against a `stage`d tree) and from the page during a launch (`--- script-write <id> <target>
  <fixture> <replace|inplace>` and `--- script-burst <id> <target> <fast|slow> <fixture>…`, answered
  once per id).
- **Fixture import with SHA-256.** `import <name>` takes the source the manifest names (`repo:` =
  the committed synthetic corpus, `harness:` = `fixtures-src/`; a path that is absolute, climbs,
  is a symlink, resolves outside its root or passes through `corpus/real/` is refused), copies it to
  a `noclobber` temporary inside `fixtures/`, hashes **the copy that landed**, and renames it into
  place only on a match (exit 66 otherwise, temporary removed). An existing destination is never
  overwritten: it is either verified or refused (exit 67). `verify` re-checks landed files, and
  every `stage`, `launch` and writer run verifies each fixture it uses before touching anything,
  and `stage`/`launch` re-hash each staged copy. `present` entries (the 20 pre-2d-7 harness fixtures) are verify-only.

### 1.2 `tools/post-input` — the synthesized-input tool (entry 20)

`post-input --pid <pid> --window <id> [--dry-run] click <x> <y>` or `… key <virtual-keycode>`.
Before posting — and a dry run applies every check and only skips the post — it requires, in order:
exact arguments; an unlocked screen (the same session-dictionary source); `AXIsProcessTrusted()`;
the window id naming exactly one window, owned by `--pid`, at layer 0, on screen, with a non-empty
frame; for a click, the point inside that frame; for a key press, the process's Accessibility focused
window being exactly that window id (§9.2); and, immediately before posting, the same window facts
unchanged and, for a key press, the same focus. It posts with `CGEvent.postToPid(pid)` — that one process's queue, not the global
HID stream — and a click carries the window id in both window-under-pointer fields. One output line;
distinct exit codes per refusal (header of `post-input.swift`).

What it does **not** force is written in its header: that AppKit routes the click by the window
fields rather than by its own hit test (unverified), that a posted click grants WebKit user
activation (unverified, so the copy stays the owner's gesture, entry 20), the interval between the
last check and the post (narrowed, not closed; for a key press, focus moving inside it is not
closed either), and that the focus check relies on the private `_AXUIElementGetWindow` (a failure
of it is a refusal, never a guess).

**Build** (from `tools/`): `swiftc -O -o post-input post-input.swift`. **At 2d-7-9 it needs:** the
owner present; the screen unlocked; Accessibility granted by the owner, in System Settings → Privacy
& Security → Accessibility, to the binary `tools/post-input` or to the terminal that runs it; the
target pid (`pgrep -f <launch>/espansoConfig.app/Contents/MacOS/espansoconfig`) and window id
(`tools/winid <pid>`, first field).

---

## 2. Design choices, and why

1. **One script with subcommands, not a launch script plus helpers.** The writers and the import
   have to be shown working without a launch (the evidence below), and the in-launch answers must
   run the same code; a subcommand and the page-request handler both call `run_writer`.
2. **Writes are done in Perl, not in shell.** `bash` 3.2 (macOS `/bin/bash`) has no sub-second clock
   and no `O_NOFOLLOW`; a `perl` spawn per timestamp cost ~8 ms and blurred the 60 ms spacing (first
   fast burst measured `+68.0`/`+129.3` ms, §3.4). The one Perl routine reads every fixture first,
   then writes on an absolute schedule. Perl and its `Fcntl`, `Time::HiRes` and `Digest::SHA` are
   the system's own.
3. **The manifest is authored once, from bytes, and its own hash is recorded here** (§5). The hashes
   of the fifteen byte-exact fixtures come from the committed synthetic corpus, which was unmodified
   (`git status --short crates/espansoconfig-core/tests/corpus/synthetic` printed nothing). The 20
   `present` entries pin today's bytes of files earlier phases authored; they prove the bytes have
   not changed since this phase, **not** where the bytes came from.
4. **Imported fixtures land in `fixtures/`**, not a new directory, because `probe.rs` requires a
   probe writer's fixture to be a regular file directly inside `<HARNESS_ROOT>/fixtures`.
5. **The lock is read twice and a disagreement counts as locked**, because the session key is not
   public API and a window capture of a lock screen is worse than no capture.
6. **`activate` is carried over from `launch-10.sh` unchanged**, so a foreground reading can still be
   run through the 2d-7 harness; nothing here uses it.
7. **A copying case refuses a clipboard it cannot put back exactly, rather than preserving every
   representation** (§9.3). `pbpaste`/`pbcopy` carry plain text only; saving and re-writing every
   type of every item would need a new tool that copies arbitrary pasteboard data (including
   promised and file types) and a proof that the restored board equals the old one, which nothing
   here could give. A refusal is checkable: the one clipboard shape accepted is the one `pbcopy`
   itself writes.

---

## 3. Evidence (commands and observed output)

All of it ran with the screen **locked** (09:02–09:05); that is recorded, not hidden. Paths are
under the harness root unless absolute.

### 3.1 The lock-state preflight line

```
$ ./launch-7.sh preflight
--- preflight lock=locked rule=primary-locked primary="locked source=CGSessionCopyCurrentDictionary CGSSessionScreenIsLocked=1 kCGSessionOnConsoleKey=true" cross-check=ioreg:IOConsoleUsers[uid=501,onConsole=true].CGSSessionScreenIsLocked=true at=09:02:05.669
$ tools/lockstate            # exit 10
locked source=CGSessionCopyCurrentDictionary CGSSessionScreenIsLocked=1 kCGSessionOnConsoleKey=true
```

### 3.2 Two consecutive launches: distinct identifiers and paths

The instrumented binary was built with `cargo build -p espansoconfig --features custom-protocol`
after `npm run build` (binary SHA-256 `7857f02575e0f131618f2f9dfcd376ba0470cfcfdb2f78cdfa9823830f2e7860`).

```
$ ./launch-7.sh launch lifecycle-open:en S7-L01
--- preflight lock=locked rule=primary-locked primary="locked source=CGSessionCopyCurrentDictionary CGSSessionScreenIsLocked=1 kCGSessionOnConsoleKey=true" cross-check=ioreg:IOConsoleUsers[uid=501,onConsole=true].CGSSessionScreenIsLocked=true at=09:03:32.956
bundle-id=cc.carpio.espansoConfig.probe.S7-L01 lsappinfo-bundle-id=cc.carpio.espansoConfig.probe.S7-L01 bundle-path=/private/tmp/espansoconfig-harness-2d-6-6c-2/launches/S7-L01/espansoConfig.app
reached-terminal=yes alive-at-kill=yes
language-line=--- language picked=en lang=en label=ok
last-beat=
end-lines=1
failed-lines=0
mismatch-lines=0
probe.err-bytes=0
script-writers=0
lock-at-end=locked (primary-locked)
webkit-data=/Users/ccarpio/Library/WebKit/cc.carpio.espansoConfig.probe.S7-L01
[file hashes and an empty tree-diff]

$ ./launch-7.sh launch status-removed:es S7-L02
--- preflight lock=locked rule=primary-locked … at=09:03:40.312
bundle-id=cc.carpio.espansoConfig.probe.S7-L02 lsappinfo-bundle-id=cc.carpio.espansoConfig.probe.S7-L02 bundle-path=/private/tmp/espansoconfig-harness-2d-6-6c-2/launches/S7-L02/espansoConfig.app
reached-terminal=yes alive-at-kill=yes
language-line=--- language picked=es lang=es label=ok
end-lines=1  failed-lines=0  mismatch-lines=0  probe.err-bytes=0
shot rm-removed used=webview webview-file-bytes=198557
lock-at-end=locked (primary-locked)
webkit-data=/Users/ccarpio/Library/WebKit/cc.carpio.espansoConfig.probe.S7-L02
tree-diff:
Only in …/launches/S7-L02/xdg-before/espanso/match: other.yml     # the plan's own probe remover

$ cat launches-7.ledger
S7-writers cc.carpio.espansoConfig.probe.S7-writers staged-only 2026-09-23T09:02:34
S7-L01 cc.carpio.espansoConfig.probe.S7-L01 …/launches/S7-L01/espansoConfig.app 2026-09-23T09:03:33
S7-L02 cc.carpio.espansoConfig.probe.S7-L02 …/launches/S7-L02/espansoConfig.app 2026-09-23T09:03:40
$ /usr/libexec/PlistBuddy -c 'Print CFBundleIdentifier' launches/S7-L0{1,2}/espansoConfig.app/Contents/Info.plist
cc.carpio.espansoConfig.probe.S7-L01
cc.carpio.espansoConfig.probe.S7-L02
```

The capture path, from `launches/S7-L02/launch.txt` and `probe.log`:

```
running pid=31690 lsappinfo-bundle-id=cc.carpio.espansoConfig.probe.S7-L02 at=09:03:41.051
capture rm-removed used=webview reason=screen-locked(primary-locked) file=shots/rm-removed-webview.png lock=locked at=09:03:43.647
--- shot rm-removed t=1806ms
--- shot-done rm-removed webview=written#2 t=4408ms
$ ls launches/S7-L02/shots
keepalive-webview.png
rm-removed-webview.png
```

Refusals, with no launch made:

```
$ ./launch-7.sh launch lifecycle-open:en S7-L01     # exit 65
refused: launch name S7-L01 has already been used; pick another
$ ./launch-7.sh launch lifecycle-open S7-L03        # exit 68
refused: the plan lifecycle-open is not <case>:en or <case>:es (the language is set through the picker, so it is named)
```

(Each also printed the preflight line first.) The images were not opened and nothing is claimed about
what they show.

### 3.3 A writer run on a synthetic `config/` file

```
$ ./launch-7.sh stage S7-writers --config config-crlf-bom-r0.yml
staged /private/tmp/espansoconfig-harness-2d-6-6c-2/launches/S7-writers config=config-crlf-bom-r0.yml
$ shasum -a 256 …/config/default.yml ; xxd … | head -1 ; ls -li …/config/
ae83223fc0dc30982e4d66febefd1f1f541b6d85607f9c67fae90f16ca5a056f  launches/S7-writers/xdg/espanso/config/default.yml
00000000: efbb bf23 2053 796e 7468 6574 6963 2032  ...# Synthetic 2
404832460 -rw-r--r--@ 1 ccarpio  wheel  120 Sep 23 09:02 default.yml

$ ./launch-7.sh write S7-writers config/default.yml config-crlf-bom-r1.yml replace
writer id=cli-write-090236 target=config/default.yml mode=replace gap=0ms writes=1 before-sha256=ae83223fc0dc30982e4d66febefd1f1f541b6d85607f9c67fae90f16ca5a056f at=09:02:37.023
write 1/1 mode=replace fixture=config-crlf-bom-r1.yml start=+0.0ms took=0.2ms bytes=125 fixture-sha256=09b80d14…9160f after-sha256=09b80d14765dfefef5705c502be09749e41360532e64952d92d4c91208e9160f ok
writer id=cli-write-090236 done status=0 final-sha256=09b80d14765dfefef5705c502be09749e41360532e64952d92d4c91208e9160f at=09:02:37.051
404832477 -rw-r--r--@ 1 ccarpio  wheel  125 Sep 23 09:02 default.yml          # new inode: a rename

$ ./launch-7.sh write S7-writers config/default.yml config-crlf-bom-r2.yml inplace
writer id=cli-write-090237 … mode=inplace … before-sha256=09b80d14765dfefef5705c502be09749e41360532e64952d92d4c91208e9160f
write 1/1 mode=inplace fixture=config-crlf-bom-r2.yml … bytes=122 … after-sha256=259ad87df93c9df94ecfff02b1406a4af0c6c1709b58d1ace63ecb2bccbb2311 ok
writer id=cli-write-090237 done status=0 final-sha256=259ad87df93c9df94ecfff02b1406a4af0c6c1709b58d1ace63ecb2bccbb2311
404832477 -rw-r--r--@ 1 ccarpio  wheel  122 Sep 23 09:02 default.yml          # same inode: in place
00000070: 733a 2066 616c 7365 0d0a                 s: false..            # CRLF kept
```

(The CLI writer ids later gained the process id, `cli-write-<time>-<pid>`, so two writes in one
second cannot share an id; the bursts below show the new form.)

### 3.4 A burst run

The first fast burst, before the sleep-then-spin wait, measured `start=+68.0ms` and `+129.3ms` for
writes 2 and 3. After the change:

```
$ ./launch-7.sh burst S7-writers config/default.yml fast config-crlf-bom-r1.yml config-crlf-bom-r2.yml config-crlf-bom-r0.yml
writer id=cli-burst-090255-30310 target=config/default.yml mode=replace gap=60ms writes=3 before-sha256=dea66475e97998a999657d34113f480a2d717580cdc97dff66bf56a6843cb6a7 at=09:02:55.384
write 1/3 … fixture=config-crlf-bom-r1.yml start=+0.0ms took=0.3ms bytes=125 … after-sha256=09b80d14765dfefef5705c502be09749e41360532e64952d92d4c91208e9160f ok
write 2/3 … fixture=config-crlf-bom-r2.yml start=+60.0ms took=0.2ms bytes=122 … after-sha256=259ad87df93c9df94ecfff02b1406a4af0c6c1709b58d1ace63ecb2bccbb2311 ok
write 3/3 … fixture=config-crlf-bom-r0.yml start=+120.0ms took=0.3ms bytes=120 … after-sha256=ae83223fc0dc30982e4d66febefd1f1f541b6d85607f9c67fae90f16ca5a056f ok
writer id=cli-burst-090255-30310 done status=0 final-sha256=ae83223fc0dc30982e4d66febefd1f1f541b6d85607f9c67fae90f16ca5a056f at=09:02:55.534

$ ./launch-7.sh burst S7-writers config/default.yml slow config-crlf-bom-r3.yml config-crlf-bom-r1.yml
writer id=cli-burst-090255-30369 … gap=600ms writes=2 before-sha256=ae83223fc0dc30982e4d66febefd1f1f541b6d85607f9c67fae90f16ca5a056f
write 1/2 … fixture=config-crlf-bom-r3.yml start=+0.0ms took=0.2ms bytes=119 … after-sha256=dea66475e97998a999657d34113f480a2d717580cdc97dff66bf56a6843cb6a7 ok
write 2/2 … fixture=config-crlf-bom-r1.yml start=+600.0ms took=0.5ms bytes=125 … after-sha256=09b80d14765dfefef5705c502be09749e41360532e64952d92d4c91208e9160f ok
writer id=cli-burst-090255-30369 done status=0 final-sha256=09b80d14765dfefef5705c502be09749e41360532e64952d92d4c91208e9160f at=09:02:56.242
```

Refusals:

```
$ ./launch-7.sh write S7-writers config/other.yml config-crlf-bom-r1.yml           # exit 71
refused: the writer target config/other.yml is not one of the four
$ ln -s /private/tmp/2d7-4-1-demo-good.yml …/match/extra.yml
$ ./launch-7.sh write S7-writers match/extra.yml config-crlf-bom-r1.yml            # exit 71
refused: …/launches/S7-writers/xdg/espanso/match/extra.yml is neither absent nor a regular file
$ shasum -a 256 /private/tmp/2d7-4-1-demo-good.yml                                  # the link's target, untouched
fb74414a695e7fb0a7f975f2e439ce5fb5295423aa0427eb89b6c293f7535294
$ ./launch-7.sh burst S7-writers config/default.yml fast config-crlf-bom-r1.yml    # exit 64
refused: a fast burst is three writes, not 1
```

**The page-request path** (`answer_writer`, the code a launch runs on a `--- script-*` line) was
exercised against a second staged tree, `S7-requests`, by sourcing the script's functions
(`sed '/^# Dispatch$/,$d' launch-7.sh > /private/tmp/2d7-4-1-functions.sh`) and feeding it five
request lines, because no page prints those lines yet:

```
writer id=w1 … mode=inplace … after-sha256=09b80d14…9160f ok          → script-writer w1 exit=0
writer id=b1 … gap=60ms writes=3 … start=+60.0ms … start=+120.0ms … ok → script-writer b1 exit=0
refused: a slow burst is two writes, not 1                            → script-writer b2 refused
script-writer refused: malformed request (script-write W3 …)          # upper-case id
refused: the writer target ../x is not one of the four                → script-writer w4 exit=71
```

### 3.5 The fixture import: accepted, and refused when tampered

```
$ ./launch-7.sh import config-crlf-bom-r0.yml
import config-crlf-bom-r0.yml accepted source=harness:synthetic-7/config-crlf-bom-r0.yml sha256=ae83223fc0dc30982e4d66febefd1f1f541b6d85607f9c67fae90f16ca5a056f
$ ./launch-7.sh import crlf-line-endings.yml
import crlf-line-endings.yml accepted source=repo:crlf-line-endings.yml sha256=bc010c851c76d17071ff8fa93925ef655c272b8556146724a786dacf7614a0f8
$ ./launch-7.sh import crlf-line-endings.yml
import crlf-line-endings.yml ok: already present and verified sha256=bc010c851c76d17071ff8fa93925ef655c272b8556146724a786dacf7614a0f8
```

(The other three config fixtures and the other fourteen byte-exact fixtures were imported the same
way, each `accepted`.) Tampering the **source** (one byte of `fixtures-src/synthetic-7/demo-tamper-r0.yml`,
`fb74414a…5294` → `c5a41eb6…0567`):

```
$ ./launch-7.sh import demo-tamper-r0.yml                                           # exit 66
import demo-tamper-r0.yml REFUSED: sha256 mismatch source=harness:synthetic-7/demo-tamper-r0.yml expected=fb74414a695e7fb0a7f975f2e439ce5fb5295423aa0427eb89b6c293f7535294 actual=c5a41eb687ac9f3ed4944d9c69b330a01fe92d7ad6fc6de46fc7d799bfbb0567 (nothing landed)
$ ls fixtures | rg -c 'demo-tamper|\.import-'   → no match
```

With the source restored and imported (`accepted`), tampering the **landed copy** in `fixtures/`:

```
$ ./launch-7.sh verify demo-tamper-r0.yml                                           # exit 66
fixture demo-tamper-r0.yml REFUSED: sha256 mismatch expected=fb74414a…5294 actual=c5a41eb6…0567
$ ./launch-7.sh stage S7-tamper --config demo-tamper-r0.yml                        # exit 66
refused: fixture demo-tamper-r0.yml failed verification; nothing was staged
$ ls -d launches/S7-tamper → No such file or directory
$ ./launch-7.sh import demo-tamper-r0.yml                                           # exit 67
import demo-tamper-r0.yml REFUSED: fixtures/demo-tamper-r0.yml exists with sha256=c5a41eb6…0567, not the manifest's fb74414a…5294 (not overwritten)
```

After removing the tampered copy and re-importing (`accepted`), `./launch-7.sh verify` over all 40
entries exited 0 with 40 `ok` lines and no `REFUSED`.

### 3.6 The input tool: build, and a dry run on the locked screen

```
$ cd tools && swiftc -O -o post-input post-input.swift     # no output, exit 0
$ swiftc -O -o lockstate lockstate.swift                   # no output, exit 0
$ file post-input lockstate
post-input: Mach-O 64-bit executable arm64
lockstate:  Mach-O 64-bit executable arm64
$ tools/post-input --pid 999999 --window 999999 --dry-run click 10 10               # exit 10
post-input dry-run=true pid=999999 window=999999 click x=10.0 y=10.0 lock=CGSSessionScreenIsLocked:1,onConsole:true result=refused: the screen is locked
$ tools/post-input --pid 1 click 10                                                # exit 64
post-input result=refused: usage: --pid and --window are both required
```

The dry run named no real window or process and posted nothing; the lock refusal comes before the
window lookup. No event was posted in this phase. (Swift 6.4, `swiftlang-6.4.0.30.4`, arm64.)

### 3.7 No full-screen capture

```
$ rg -n screencapture launch-7.sh
42:#     answered with `screencapture -l <window>` when the screen is unlocked, and
459:    elif screencapture -x -o -l "$id" "$LAUNCH/shots/$tag-window.png" 2>> "$LAUNCH/launch.txt" && [[ -s "$LAUNCH/shots/$tag-window.png" ]]; then
```

---

## 4. Gates (instrument present)

| Command | Exit | Result |
|---|---|---|
| `cargo fmt --check` | 0 | no output |
| `cargo clippy --workspace --all-targets -- -D warnings` | 0 | log `/private/tmp/2d7-4-1-clippy.log` |
| `cargo test --workspace -- --test-threads=1` (to `/private/tmp/2d7-4-1-cargo-test.log`) | 0 | **1330 passed**, 0 failed (summed from the log's `test result:` lines) |
| `npm run check` | 0 | `COMPLETED 462 FILES 0 ERRORS 0 WARNINGS 0 FILES_WITH_PROBLEMS` |
| `npm test` | 0 | `Test Files 72 passed (72)`, `Tests 3547 passed (3547)` |
| `npm run build` | 0 | `✓ 201 modules transformed.`; server-only oracle absent, client-only oracle `index-DRKJ1ghX.js:2` |

No figure moved: this phase changed no repository source.

---

## 5. Hashes as of this phase

`shasum -a 256`, under the harness root. **These are this phase's record, not the reviewed set**:
`2d-7-4-2` records the final reviewed-set hashes of the four instrument paths, `launch-7.sh` and
`tools/*` at its close, and copies them to `/private/tmp/2d7-instrument-reviewed/` (entry 3). The rows
for `launch-7.sh`, `tools/post-input*` and `tools/pbstate*` are **after the review fixes** (§9); the
transcripts in §3 ran against the pre-fix script (`8f419948…8dff`), whose other behaviour the fixes
did not change.

| File | SHA-256 |
|---|---|
| `launch-7.sh` | `aac7c94ad0084605a20ec2a4301159400260d674b03b595385f1adf91c0db074` |
| `fixtures-7.manifest` | `73840ba8a59a7c87953abda733b2118d7668edc37d7444ffbfd3bc98693d30e5` |
| `tools/lockstate` | `8d063b0dde57062060a79de43838a72c309a7cec219d83a1f1f00d434d11f626` |
| `tools/lockstate.swift` | `b97e8a4f2063c77c84f2f24bb141c893fe2cd8fa263cd90105c16d73be1ddf65` |
| `tools/pbstate` | `5c92bddf29d1b7ce3b6dd6922f67f9fc8983694ea7d1a099650b4d8866e2597f` |
| `tools/pbstate.swift` | `eead41c0141667af6e2c8df4e79a5d0eca211dbcc77728acfe9c7643a9528d25` |
| `tools/post-input` | `d92667c91f94101c0c43602ad4db8b4deeb6531febd7c0a2d8f1e416b653caba` |
| `tools/post-input.swift` | `c2858a4b6256bac56156cfb6f37cf879344a06bd9b7267c9fa441f4412eedd18` |
| `tools/verbatim-7c.cjs` (unchanged) | `92169e47288190ba4175ca8e4146921510cc7359db00f072bb3dc47e8e48d927` |
| `tools/verbatim-8c.cjs` (unchanged) | `330a58d4874897921a965c8e3d47b9732488844496900205dc783f5377f3bb30` |
| `tools/verbatim-9c.cjs` (unchanged) | `36fe24f0d758ac8e633ff76d1a73753aaac0be8fa2f28adf1f9ab006538c8d5e` |
| `tools/verbatim.cjs` (unchanged) | `d9a8131e1bed474a82fbefb95ce666cade9e312c156e7f9f2155ffb6a081fd25` |
| `tools/winid` (unchanged) | `5d066422c58e4402cc9aa72205958ea76e94367f1349e8e961732d2e8458ea24` |
| `tools/winid.swift` (unchanged) | `49cdd1880bdda5a7225bff012f5cab9bd738b3e5239341eaa3b3666fcba89c5f` |
| `fixtures-src/synthetic-7/config-crlf-bom-r0.yml` | `ae83223fc0dc30982e4d66febefd1f1f541b6d85607f9c67fae90f16ca5a056f` |
| `fixtures-src/synthetic-7/config-crlf-bom-r1.yml` | `09b80d14765dfefef5705c502be09749e41360532e64952d92d4c91208e9160f` |
| `fixtures-src/synthetic-7/config-crlf-bom-r2.yml` | `259ad87df93c9df94ecfff02b1406a4af0c6c1709b58d1ace63ecb2bccbb2311` |
| `fixtures-src/synthetic-7/config-crlf-bom-r3.yml` | `dea66475e97998a999657d34113f480a2d717580cdc97dff66bf56a6843cb6a7` |
| `fixtures-src/synthetic-7/demo-tamper-r0.yml` | `fb74414a695e7fb0a7f975f2e439ce5fb5295423aa0427eb89b6c293f7535294` |

The compiled binaries' hashes are not reproducible across compilers; the `.swift` sources are what a
review reads.

---

## 6. Deviations

1. **The unlocked capture branch was never run.** The screen was locked for the whole phase, so
   `used=window` and both `window-capture-failed`/`no-window` fallbacks are read from the source
   only. The locked branch (`used=webview reason=screen-locked(…)`) ran once, in `S7-L02`.
2. **The page-request writer path was exercised by sourcing the script's functions**, not by a page:
   `probe.ts` prints no `--- script-*` line yet (§3.4).
3. **Three smoke launches** (`S7-L01`, `S7-L02`, and `S7-L03` for review fix 3), all on a locked
   screen, all reaching `--- end`. They show the harness,
   not the instrument; no reading is claimed from them.
4. **Scratch files outside the harness tree:** `/private/tmp/2d7-4-1-*.log` (gate logs),
   `/private/tmp/2d7-4-1-functions.sh`, `/private/tmp/2d7-4-1-demo-good.yml`, the race transcripts
   `/private/tmp/2d7-4-1-race-*.txt` and `2d7-4-1-r*-*.txt`, and the fake reader
   `/private/tmp/2d7-4-1-fakepb/`. The staged trees `S7-race`, `S7-race-1` … `S7-race-5` are under
   `launches/`. Not instrument;
   this phase's scratch.

---

## 7. What this does not prove

- A matching manifest hash proves the bytes are the manifest's bytes, not that the manifest was
  right; the `present` entries pin bytes whose origin is an earlier phase's record.
- The lock reading relies on a private session key read twice; both sources could change meaning
  together on a later macOS.
- The writers' directory-above rebinding is open (header of `launch-7.sh`), the same class as
  `probe.rs`'s third rebinding.
- Nothing about `post-input` on a real window: delivery, routing by window id, `isTrusted`, and user
  activation are all 2d-7-9's to observe.

---

## 8. Open items for `2d-7-4-2`

1. **`probe.rs:108-110` names the wrong script.** The `HARNESS_ROOT` doc says it "has to agree with
   `launch.sh`'s `HARNESS`"; from 2d-7 on the script is `launch-7.sh` (same root, so no behaviour
   differs). A wording fix in `probe.rs`, which this phase may not touch.
2. **The page side of the writer protocol.** `probe.ts` must print `--- script-write <id> <target>
   <fixture> <replace|inplace>` / `--- script-burst <id> <target> <fast|slow> <fixture>…` and learn
   completion itself — from `probe_witness` (the target's hash equals the last `fixture-sha256`) or a
   hold. The script does not signal completion. Entry 16's "except those a probe or script writer
   changed" can be read from `<launch>/writers.log`, whose `final-sha256` is the hash each witness
   must equal.
3. **`shot()` token attribution** (2d-7-3 §6 item 1) is still open: `S7-L02` printed
   `--- shot-done rm-removed webview=written#2` while the keep-alive was running
   (`keepalive-webview.png` exists), which is the ambiguity entry 10 describes.
4. **The keep-alive ran unasked** in `S7-L02` (a status plan); making it an explicit plan flag is on
   2d-7-4's list.
5. **No `--- beat` line** exists yet (`last-beat=` empty in both launches); `launch-7.sh` already
   prints the last one when there is one (entry 19).
6. **The staged fixture set is `launch-10.sh`'s hard set** (`R0…R5`); a plan that needs another set
   (2d-7-7's fifteen, all now imported and in the manifest) has to widen `build_tree` and the
   `ECFG_PROBE_R*` list together.
7. **The instrument review's checklist item 13** (entry 7) reads `tools/post-input.swift`: it posts
   to one pid naming one window id; the dry-run-on-a-locked-screen refusal is §3.6 above.
8. **Per-launch WebKit data** now accumulates as `~/Library/WebKit/cc.carpio.espansoConfig.probe.<launch>`
   (seen for `S7-L01`, `S7-L02`), which entry 32 already lists. Also seen, and in no manifest:
   `~/Library/WebKit/espansoconfig` and `~/Library/Caches/espansoconfig` (lower-case, origin not
   established). Reported, not deleted.
9. **`COPY_CASES` in `launch-7.sh` must follow the page.** It lists the cases that press a copy
   control (today `external-editor`, from `probe.ts`'s `copyDraft` choice). Nothing checks it against
   `probe.ts`; a page change that adds or prunes a copying case updates it, or that case overwrites
   the person's clipboard with nothing put back.

---

## 9. Review fixes

The review (`docs/reviews/phase-2d-7-4-1.md`, Codex, ship-with-fixes) named one blocker and two
should-fix findings. Each was re-derived against the code before it was fixed; all three hold. Only
`launch-7.sh` and `tools/post-input.swift` were changed for them, plus the new `tools/pbstate.swift`
that fix 3 needs. `bash -n launch-7.sh` exits 0 after the fixes. No tracked source changed, so no
Rust or TypeScript gate was re-run; the four instrument hashes are still those of §0.

### 9.1 BLOCKER — launch names were not reserved atomically

**Re-derivation: holds.** `claim_launch_name` only tested `-e "$LAUNCH"`, the ledger and the WebKit
directories, and created nothing; `build_tree` then ran `mkdir -p`, which succeeds on a directory
that already exists. Two invocations with one new name could both pass every check and share the tree,
the bundle path and the identifier.

**Fix.** `build_tree` now reserves the name with `mkdir "$LAUNCH"` (no `-p`) after the fixtures verify
and before anything is created, and refuses with exit 65 if it fails. The earlier checks stay as a
friendly early refusal, and their comment now says they reserve nothing. Nothing in the script
deletes a launch directory, so a reservation whose later steps refuse stays on disk and the name
stays spent. A fixture that fails verification refuses before the reservation, so it spends no name
(as §3.5's `S7-tamper` showed). The ledger line is still written after the reservation, so it can
never record two owners of one name.

**Transcript** (two `stage` invocations with one name, started together; `stage` runs the same
`claim_launch_name` and `build_tree` as `launch`):

```
$ ./launch-7.sh stage S7-race > …race-a.txt 2>&1 & ./launch-7.sh stage S7-race > …race-b.txt 2>&1 & wait
staged /private/tmp/espansoconfig-harness-2d-6-6c-2/launches/S7-race config=default-config.yml
A exit=0
refused: launch name S7-race was reserved by another invocation (mkdir /private/tmp/espansoconfig-harness-2d-6-6c-2/launches/S7-race failed)
B exit=65
$ rg -c S7-race launches-7.ledger
1
```

The refused invocation got past the early checks, since its refusal is the `mkdir` one, which is the
race the finding describes. Five more trials (`S7-race-1` … `-5`):

```
trial 1:    1 refused: launch name S7-race-1 was reserved;   1 staged; ledger-lines=1
trial 2:    1 refused: launch name S7-race-2 was reserved;   1 staged; ledger-lines=1
trial 3:    1 refused: launch name S7-race-3 was reserved;   1 staged; ledger-lines=1
trial 4:    1 refused: launch name S7-race-4 was reserved;   1 staged; ledger-lines=1
trial 5:    1 refused: launch name S7-race-5 was reserved;   1 staged; ledger-lines=1
```

**What it does not force:** the WebKit/Caches and ledger checks for *different* names that map to one
identifier are impossible here (the identifier is the name), so the directory is the only shared
resource. `mkdir`'s atomicity is the file system's, not the script's.

### 9.2 SHOULD-FIX — a key press was not confined to the named window

**Re-derivation: holds.** For `key`, `checkWindow` checked ownership, layer, visibility and frame, and
`postToPid` delivered the key events to the process. A key event has no window field, so it reached
whichever window of that process held focus, whatever `--window` said.

**Fix.** `checkKeyboardFocus` in `tools/post-input.swift` runs for `key` only, after the window check
and again in the last look before posting. It reads `kAXFocusedWindowAttribute` from
`AXUIElementCreateApplication(pid)`, maps the element to a window id with `_AXUIElementGetWindow`, and
refuses with exit 17 if the attribute cannot be read, is not an AX element, has no obtainable window
id, or names another window. The header lists it as check 6 and states what stays open. Focus moving
between the last check and the post is not closed. `_AXUIElementGetWindow` is private: the tool
declares it itself, and a failure of it is a refusal, never a guess from the frame. Clicks are
unchanged.

**Build and dry run** (not exercised on a real window; the dry run names no real process):

```
$ cd tools && swiftc -O -o post-input post-input.swift        # no output, exit 0
$ file post-input
post-input: Mach-O 64-bit executable arm64
$ nm -u post-input | rg AXUIElement
_AXUIElementCopyAttributeValue
_AXUIElementCreateApplication
_AXUIElementGetTypeID
__AXUIElementGetWindow
$ ./post-input --pid 999999 --window 999999 --dry-run key 48                        # exit 10
post-input dry-run=true pid=999999 window=999999 key code=48 lock=CGSSessionScreenIsLocked:1,onConsole:true result=refused: the screen is locked
```

The binary started and ran to its refusal, so dyld resolved the private symbol on this host. The
focus check itself has never run: it comes after the lock and Accessibility checks, and both refuse
here. It is 2d-7-9's to observe.

### 9.3 SHOULD-FIX — the clipboard was overwritten unconditionally, text only

**Re-derivation: holds.** Every launch ran `pbpaste` before and `printf … | pbcopy` after, whatever the
plan. For a plan that never copies, that still rewrote the clipboard. A non-text payload (an image,
rich text, files) was replaced by its plain-text part or by an empty string.

**Fix.**
- **A case with no copy action** (every case not in `COPY_CASES`) neither reads the clipboard's
  content nor writes it.
- **A copying case** (`external-editor` today, the only `probe.ts` plan that presses `copyDraft`) is
  **refused** with exit 73 unless the clipboard is empty or exactly one item whose only type is
  `public.utf8-plain-text`. The check runs before the name is claimed and again just before the app
  opens. A refusal at the second check leaves a spent reservation. Afterwards the text is put back
  with `pbcopy`, or an empty clipboard is cleared with `tools/pbstate clear`.
- The new `tools/pbstate` reports `NSPasteboard`'s `changeCount` and item types and never reads data.
  Every launch logs `clipboard-before`/`clipboard-after` and a summary line.

**Refuse, not preserve, and why:** §2 item 7. The one shape accepted is the one `pbcopy` writes, so
putting it back reproduces the same items and types. The refusal is what the script forces. The
restore is plain-text-exact only, and a change the app makes to the types during the launch is
overwritten by the restore.

**Transcript, a no-copy plan** (`lifecycle-open`, screen locked). The change count, which rises on
every pasteboard write, is the same before and after:

```
$ tools/pbstate
changeCount=214 items=1 types=public.utf8-plain-text
$ ./launch-7.sh launch lifecycle-open:en S7-L03
--- preflight lock=locked rule=primary-locked … at=09:14:25.370
bundle-id=cc.carpio.espansoConfig.probe.S7-L03 lsappinfo-bundle-id=cc.carpio.espansoConfig.probe.S7-L03 …
reached-terminal=yes alive-at-kill=yes
language-line=--- language picked=en lang=en label=ok
end-lines=1  failed-lines=0  mismatch-lines=0  probe.err-bytes=0
clipboard copies=no before=[changeCount=214 items=1 types=public.utf8-plain-text] after=[changeCount=214 items=1 types=public.utf8-plain-text]
…
$ tools/pbstate
changeCount=214 items=1 types=public.utf8-plain-text
```

**The copy-case gate**, shown without launching and without touching the clipboard. The script's
functions were sourced, then fed a fake `pbstate` in `/private/tmp/2d7-4-1-fakepb/` that reports an
image plus text:

```
real clipboard: restorable-exit=0 [changeCount=214 items=1 types=public.utf8-plain-text]
fake image+text: restorable-exit=1 [changeCount=9 items=1 types=public.png,public.utf8-plain-text]
$ run_launch external-editor:en S7-L99
--- preflight lock=locked rule=primary-unknown-counted-locked primary="…/2d7-4-1-fakepb/lockstate: No such file or directory" …
refused: the case external-editor copies to the clipboard, which holds more than plain text (changeCount=9 items=1 types=public.png,public.utf8-plain-text); it could not be put back exactly
$ ls -d launches/S7-L99
ls: …/launches/S7-L99: No such file or directory
```

The fake tools directory also hid `lockstate`, so that preflight counted the unknown lock state as
locked, which is the intended conservative reading. The exit status 73 was not captured, because
`exit` inside the sourced function ended the `bash -c` shell. A real copying case with a real
clipboard was not launched.
