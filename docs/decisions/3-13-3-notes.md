# Phase 3-13-3 — Display names and creation defaults: the window half

**Spec:** `docs/decisions/3-split-notes.md` §2 *3-13* and its 2026-09-24 addendum (the 3-13-3 bullet), ruling
30, §4.1, §4.8; `docs/decisions/3-13-2-notes.md` §1 (what the components draw), §5 and §6.
**Risk:** high. The launch-by-launch reading is [`3-13-3-window-reading.md`](3-13-3-window-reading.md).

**No tracked source file changed.** The phase adds two records under `docs/decisions/`. The uncommitted
instrument (§2) was deleted after the launches and before the gates.

---

## 1. What changed, and why

Step 3-13's window half (ruling 30) was taken on 2026-09-26 in an **attended session**, between 10:19:14
and 10:23:11, on an unlocked screen:

- `IOConsoleLocked` was `false` at the phase's start and before each launch.
- It was `"IOConsoleLocked" = No` before every one of the 144 captures and after each launch.

It was a model reading `screencapture -l <window>` captures of the real Tauri window, in English (L01) and
Spanish (L02), with the language set through the in-app picker in each launch and **a long display name**
in each. Per §4.1 this is **a model's look**, recorded as one; no owner judgement was sought or is claimed.
Every action on the page was a **script-dispatched DOM event**, not real input. Mounted jsdom evidence
(3-13-2 §4) is not credited here as a screen.

**All four owed items were drawn and read in both languages; three are read in full and one in part (the
measurement, whose real-paste half is unread).**

1. The sidebar drew a display name with the real path under it, in the `sortOrder` rank order. The rank
   was seeded into the scratch sidecar before launch, since nothing on screen sets it.
2. The creator drew the three seeded defaults before *Create*, each marked. One was removed; after
   *Create* its key is absent from the file on disk (`disk.diff`).
3. The preferences control saved a name and a default and drew *Preferences saved.*
4. The line-feed claim was **measured**, and it holds only in part: the `value` setter deletes a line
   feed, but text inserted through the editing path has each line break **replaced by a space** (§3,
   reading §4).

Four candidate defects or questions were seen (§5 items 1–4); none was fixed here.

### Isolation: no real espanso config, no real sidecar store

What `HOME` and `XDG_CONFIG_HOME` isolate is the espanso configuration and the sidecar store, and nothing
more is claimed. **The webview's WebKit storage is not isolated by `HOME`**: it follows the bundle
identifier (`CLAUDE.md` §6 *Window readings*; `2c-2-2-window-reading.md` §1.2), so the language override
the picker writes to `localStorage` is shared with any other bundle under the same identifier, the
owner's included. The language was set through the picker explicitly in each launch for that reason.

- **The espanso configuration** was synthetic and neutral (§2), copied per launch under
  `/private/tmp/3-13-3/L<n>/xdg/espanso/` and reached through `XDG_CONFIG_HOME`.
- **The app data** was redirected by pointing `HOME` at `/private/tmp/3-13-3/L<n>/home`.
  - Tauri's `app_data_dir()` resolves under `$HOME/Library/Application Support/<identifier>`. The
    launched process's environment was read back with `ps -E`, and both variables pointed into the
    scratch tree (`launch.txt`).
  - The sidecar each launch read and wrote was the scratch one:
    `L<n>/home/Library/Application Support/cc.carpio.espansoConfig/workspaces/<digest>.json`. It was
    rewritten with the saved name, and its seed was carried over (`sidecar.diff`, `home-listing.txt`).
  - The owner's `~/Library/Application Support/cc.carpio.espansoConfig` **did not exist before the phase
    and does not exist after it**: listings of `~/Library/Application Support` before and after show only
    the pre-existing `espanso` entry.
- **Never touched:** `~/.config/espanso` (absent) and `~/Library/Application Support/espanso`.
- **Captures** stay in `/private/tmp/3-13-3/`; none is in the repository.

## 2. The instrument (ruling 30) — uncommitted, deleted after the launches

A new, untracked directory `instrument-3-13-3/` at the repository root was rebuilt from 3-11-3's byte copy
(`/private/tmp/3-11-3/instrument-copy/instrument-3-11-3/`). **No tracked file was edited to host it**, it
was never `git add`ed, and no temporary hook in `src/` exists. The build wraps the tracked Vite
configuration and injects one module into `index.html` at build time. The language is read from a
synthetic marker file's name in the sidebar. It was deleted with `rm -r instrument-3-13-3` after both
launches (§4). A verified byte copy is kept at `/private/tmp/3-13-3/instrument-copy/instrument-3-13-3/`
(`diff` of the SHA-256 lists: identical). Its files, as they were:

| Path | SHA-256 | What it is |
|---|---|---|
| `instrument-3-13-3/vite.config.ts` | `c5ce0ea8a42f778909cb37694510527cf6d3a61cce29832ee521c990ff175afd` | 3-11-3's `probeConfig(env)` with the names changed: `mergeConfig`s one `transformIndexHtml` (`order: 'pre'`) plugin that inserts `<script type="module" src="/instrument-3-13-3/probe.ts">` before `src/main.ts` |
| `instrument-3-13-3/probe.ts` | `de7a6679695661e7b80f181a46ce389b2962f2089c8b78ca0a7c00f020602d13` | the page driver (below) |
| `instrument-3-13-3/probe.css` | `6fb539efbec0165c18240814cda867c421925ae20defcd32f4a33a274e322699` | the badge's stylesheet: fixed, bottom-left, 34vw, yellow, 9 px Menlo |
| `instrument-3-13-3/launch.sh` | `95e9d006fbf8fac63bcffe41199e43088e02b38c8ef9edaff333457c8612d283` | one launch (below) |
| `instrument-3-13-3/fixtures/config/default.yml` | `be0fe9fc046f47030ef58261c405d0eae1355319281b626b645a87b5549d70f6` | one comment line |
| `instrument-3-13-3/fixtures/match/alpha.yml` | `c3d781e7bfb2e131cba75e5c6c1a6af7d07e9a1b71069b056738c19e57b10ba3` | `:alpha1` — the preferences-control target |
| `instrument-3-13-3/fixtures/match/bravo.yml` | `7217268be9401a7331ca62aab677152cc64e696fbeda2a918cb09011db50ff48` | `:bravo1` — the named, rank-2, defaulted creation destination |
| `instrument-3-13-3/fixtures/match/charlie.yml` | `7b4b27cdf3d77357d367c720f60745d9147053725a3e21afb937c366c804ce84` | `:charlie1` — rank 1 |

**`probe.ts`**, the page driver:

- It finds buttons by exact dictionary text (it imports `src/lib/i18n/{en,es}.json`) and sidebar rows by
  path text.
- It types with `document.execCommand('insertText')` into a focused, selected box.
- It runs the line-feed measurement (`measure()`).
- It draws the badge and the DOM line (reading, *The badge*).

**`launch.sh`** runs one launch, called as `<n> <lang> <captures>`:

- It builds the scratch tree, the fixture copies and the marker file.
- It writes a scratch `HOME` whose app data dir holds the **seeded sidecar**: the digest is computed as
  `format.rs` does, with bravo's name, `sortOrder` 2 and three defaults, and charlie's `sortOrder` 1.
- It makes the `before/` and `sidecar-before.json` copies and a fresh bundle copy, runs `open -n --env`,
  and reads the environment back with `ps -E`.
- It finds the window id with `winid`, checks the lock before every capture, and captures with
  `screencapture -x -o -l`.
- After the captures it kills the app, writes `disk.diff`, `sidecar.diff` and `home-listing.txt`, and
  makes the `sips -Z 1400` copies.

Outside the repository:

- `/private/tmp/3-13-3/winid`, a byte copy of 3-11-3's helper
  (`96d06e69b448038dcface5523843d09d911469ff322fdca716886b40b75878e3`, the hash 3-11-3 recorded).
- The scratch trees `/private/tmp/3-13-3/L01` and `L02`, each with its bundle copy, `caps/`, `small/`,
  `launch.txt`, `before/`, `xdg/`, `home/`, `digest.txt`, `sidecar-before.json`, `disk.diff`,
  `sidecar.diff` and `home-listing.txt`.
- `L01/badge-c14.png` (a full-resolution copy of `c14`, read for the badge text) and
  `L02/cmp-c36-actions.png` (a crop of the pinned action block).
- `instrument-sha256.txt`, `ls-before.txt` and `ls-after.txt`.
- The logs: `build.log` (instrumented), `check.log`, `vitest.log`, `plain-build.log` and `gates.txt`.

**Build:** `npx tauri build --debug --bundles app --config
'{"build":{"beforeBuildCommand":"npx vite build --config instrument-3-13-3/vite.config.ts"}}'`, exit 0, **216
modules** (the tracked 214 plus `probe.ts` and `probe.css`). It was built once, and both launches used that
binary. The instrumented bundle lives in the gitignored `target/debug/bundle/` and must not be read as a
plain build. `dist/` was then rebuilt by the plain `npm run build` gate (214 modules). The probe's strings
`probe-3133`, `3133 ` and `instrument-3-13-3` are absent from `dist/`.

## 3. The rows classed (a model's look; never mounted evidence, never a hidden page)

Captures are `/private/tmp/3-13-3/L<n>/small/cNN.png`; L01 is EN, L02 is ES.

| Row | EN | ES | Against 3-13-2 |
|---|---|---|---|
| **1.** Sidebar: display name above the real path, the path still visible, long name | **read** L01 `c05` | **read** L02 `c05` | matches; the row's count drops to its own line under the path (§5 item 3) |
| **1.** Sidebar: `sortOrder` rank order (seeded before launch, not set on screen) | **read** L01 `c05` (charlie 1, bravo 2, then alpha and the marker unranked) | **read** L02 `c05` | matches D2 / 3-13-1 D3 |
| **1.** A name saved in the control drawn in the sidebar | **read** L01 `c23`, `c25` | **read** L02 `c25` | matches |
| **2.** Creator: seeded defaults drawn before *Create*, each marked, with the seeding notice | **read** L01 `c36` | **read** L02 `c36` | matches |
| **2.** One default removed (`propagate_case`) | **read** L01 `c43` | **read** L02 `c43` | drawn *Not set*; the seeded mark stays (§5 item 4) |
| **2.** After *Create*, the removed key absent from the file | **read** `L01/disk.diff` + L01 `c52` | **read** `L02/disk.diff` + L02 `c52` | matches; `word` written quoted (§5 item 1) |
| **3.** Preferences control: opened, name box, seven defaults, Add/Remove, suggestions | **read** L01 `c10`, `c19` | **read** L02 `c14`, `c25` | matches |
| **3.** Save: name and default in one save, *Preferences saved.* drawn, save button grey | **read in part** L01 `c25` (line legible, lower edge under the badge) | **read in part** L02 `c25` | matches; `sidecar.diff` agrees |
| **3.** Sidecar read line for a loaded sidecar | **read** (none drawn, by design) L01 `c10` | **read** L02 `c14` | matches `preferencesReadingLineOf` |
| **3.** Sidecar non-loaded statuses, refused/failed/withdrawn saves, name/default refusals | **unread** | **unread** | not reached by these fixtures |
| **4.** Line feed in a one-line `<input>` (script routes) | **measured** L01 `c14` | **measured** L02 `c14` | **the claim holds for the value setter only**; the editing path replaces LF with a space (§5 item 2) |
| **4.** Line feed by a real ⌘V paste | **unread** | **unread** | needs real input (a person) |
| The destination list shows paths only | seen L01 `c34` | — | 3-13-2 §6 item 1, now seen |
| A default seeded with LF (read-only), one withheld for CR, `kept` | **unread** | **unread** | not seeded |
| Real keyboard and pointer input; wording and layout acceptance | **unread** | **unread** | a person's (§4.1) |

**What 3-13's acceptance requires of the window, and whether it is met.** `3-split-notes.md` §2 *3-13*
states one window clause: *"Window half: EN and ES, with a long name."* Ruling 30 requires a window half
before the step closes, taken per §4.1. Both are **met**: both languages were read through the picker,
each with a long display name seeded (86 / 89 characters) and another typed (71 / 85). The step's other
acceptance clauses are carried by the models and the mounted tests of 3-13-1 and 3-13-2:

- every emitted default on screen before *Create*, and removal suppressing its key;
- empty differs from absent;
- a later preference change not touching an open draft;
- recovery values never overridden;
- an absent or corrupt sidecar leaving creation working.

This reading **also saw** the first of them in the window and on disk, in both languages, and credits
nothing beyond what the captures and diffs show. **Whether 3-13 closes is the orchestrator's call**; this
record does not rule on it. §5 item 1 names a defect in what *Create* writes that the owner may want
weighed first.

## 4. The instrument was deleted — before/after evidence

`/private/tmp/3-13-3/ls-before.txt` (10:16:52, before the instrument was created) and `ls-after.txt`
(10:24:11, after `rm -r instrument-3-13-3`) each hold `ls -a` of the repository root and `git status
--short --untracked-files=all`. `diff` between them reports **only the timestamp line**. The root holds the
same entries, with no `instrument-3-13-3`:

> `.`, `..`, `.claude`, `.DS_Store`, `.git`, `.gitignore`, `.nvmrc`, `48`, `Cargo.lock`, `Cargo.toml`,
> `CLAUDE.md`, `crates`, `dist`, `docs`, `en`, `es`, `IMPLEMENTATION_PLAN.md`, `index.html`, `intro.md`,
> `LICENSE`, `node_modules`, `package-lock.json`, `package.json`, `PROGRESS.json`, `PROGRESS.md`,
> `scripts`, `SIGN_AND_NOTARIZE.md`, `snippet`, `src`, `src-tauri`, `svelte.config.js`, `target`,
> `tsconfig.json`, `vite.config.ts`, `whole`

In both listings `git status` shows only ` M PROGRESS.json`, the pre-existing modification. `ls -d
instrument-3-13-3` afterwards answers *No such file or directory*. The only build artifacts the instrument
added inside the repository were the gitignored `target/debug/bundle/` bundle and `dist/`, and `dist/` was
rebuilt plain. No app process was left running: `pgrep -fl espansoconfig` found nothing after each launch.

## 5. Open items (noticed, not fixed here)

1. **Candidate defect — *Create* writes a seeded boolean default as a quoted string.** The seeded `word`
   default (text `true`, drawn in its box as `true`) was written to `match/bravo.yml` as `word: 'true'`, in
   both launches (`disk.diff`). `force_mode: clipboard` was written plain.
   - This is the creation path's instance of 3-10 §5 item 1 (the single-match editor quotes option values).
     The 3-10 review ruled the bulk-edit instance a **blocker**, because espanso reads `'true'` as a string
     where it expects a boolean, and fixed it with `ScalarEdit::plain_source`.
   - The creator's options, seeded or typed, evidently do not use that path.
   - The cause was not investigated here. A later phase should decide it with a test, before the owner
     relies on defaults for boolean options.
2. **Measured on two script routes only — what a real paste does is unresolved.** In the shipped
   WKWebView:
   - `execCommand('insertText')` of `one\ntwo` into a one-line `<input>` left `one two`, the line feed
     **replaced by a space** (code 32). `three\r\nfour` became `three four`.
   - The `value` setter deleted the line feed (`nineten`). A `<textarea>` kept it.
   - The sentences drawn beside the boxes say a pasted line break *is removed* / *se elimina*: the
     preferences control's `browser.filePreferences.lineEndings` and the creator's
     `browser.matchCreation.lineEndings.options`. 3-13-2 §2 D4(b)/(c) says the same.
   - A **real** ⌘V paste was not measured; it needs real input. Neither route above is a paste, so this
     reading does not say what a pasted multi-line text becomes, and it does not show the sentence wrong
     for a paste. It shows only that the two script routes disagree (space vs. deletion), so the
     sentence's accuracy for a paste is **unresolved**.
   - On both measured routes no line break reached the value.
   - A later phase should settle the wording after a real paste is read.
3. **Layout question for the owner — a named row's count drops to its own line.** With a display name the
   sidebar row draws the name, then the path, then the snippet count **on its own line, left-aligned under
   the path**. An unnamed row draws the count at the right edge on the path's line (L01 `c05`, `c25`;
   L02 `c05`). Whether this is acceptable is a layout judgement (§4.1).
4. **Wording question — a removed default keeps its *From this file's defaults* mark.** After *Remove*,
   `propagate_case` reads *Not set: the new snippet gets no such key.* and still carries the seeded mark
   (L01 `c43`, L02 `c43`). The mark then describes where the option came from, not what will be written.
5. **Seen, layout:** the creator's pinned action block (*Undo*, *Redo*, *Add this snippet*) cuts the option
   lines scrolling past it mid-line (`L02/cmp-c36-actions.png`). A person's judgement.
6. **Seen, already recorded:**
   - The creator's destination list shows paths only (3-13-2 §6 item 1; L01 `c34`).
   - Nothing on screen sets `sortOrder` (3-13-2 §6 item 2): the rank was seeded.
7. **Unread rows, not required by 3-13's acceptance, open for a later reading:**
   - a real ⌘V paste of a line break, and all real keyboard and pointer input (a person);
   - the sidecar's non-loaded statuses and refused, failed or withdrawn saves, which need fixtures with
     a corrupt, future-schema or unwritable sidecar;
   - a default seeded with a line feed (drawn read-only), one withheld for a carriage return, and `kept`;
   - wording and layout acceptance (a person).
8. **Carried unchanged:** 3-13-2 §6 items 3–4; 3-13-1 §6; the open items `PROGRESS.md`'s next action lists
   for 3-13-3.

## 6. Deviations

- **One plan per language, not one launch per row:** both launches ran the same 15-step walk, which carries
  every owed row.
- **The `sortOrder` rank was seeded in the scratch sidecar before launch**, not set on screen: no control
  sets it (§5 item 6).
- **The measurement used script routes only** (`execCommand('insertText')`, synthetic `paste` and
  `beforeinput` events, the `value` setter). A real paste was not attempted: it would need OS-level input
  and would overwrite the owner's clipboard.
- **The badge covers the footer's first words and the lower edge of *Preferences saved.***; the words were
  still legible, and the header picker and the footer's tail were read for the language.
- **The Rust gates were not run**: no Rust file changed.

## 7. Gates (the tree as left, instrument deleted)

Each command's output went to a file under `/private/tmp/3-13-3/`, and its exit status was recorded in
`gates.txt` rather than read through a pipe.

| Command | Exit | Result |
|---|---|---|
| `npm run check` | 0 | 487 files, 0 errors, 0 warnings |
| `npm test` | 0 | 88 files, 4064 passed |
| `npm run build` | 0 | 214 modules |

Bundle oracle: the server-only markers were absent and the client-only markers present (2). No probe
string was found in `dist/`.

**Rung: `1555 / 487 / 4064 / 214`**, unchanged. The Rust figure is carried from 3-15-1 and was not re-run
(§6).
