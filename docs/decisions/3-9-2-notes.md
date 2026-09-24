# Phase 3-9-2 — The file-scope inspector: the window half

**Spec:** `docs/decisions/3-split-notes.md` §2 *3-9* and its 2026-09-24 addendum (the 3-9-2 bullet), ruling
30, §4.1; `docs/decisions/3-9-1-notes.md` §1 (what the model and the components draw).
**Risk:** routine. The launch-by-launch reading is [`3-9-2-window-reading.md`](3-9-2-window-reading.md).
This phase closes step 3-9.

**Two tracked source files changed, for the review's one finding (§8):** `src/lib/components/FileScope.svelte`
draws each import's position itself, and `src/lib/components/FileScope.test.ts` asserts it. Otherwise the
phase adds two records under `docs/decisions/`; the uncommitted instrument (§2) was deleted after the fix was
re-read.

---

## 1. What was done, and why

Step 3-9's window half (ruling 30) was taken on 2026-09-24 between 12:38:28 and 12:41:57, on an unlocked
screen, by a model reading `screencapture -l <window>` captures of the real Tauri window, in English and
Spanish with the language set through the in-app picker in every launch. Per §4.1 this is **a model's look**,
recorded as one; no owner judgement was sought or is claimed. Every action on the page was a
**script-dispatched DOM event**, not real input. Mounted jsdom evidence (3-9-1 §1.4) is not credited here as a
screen.

All five shapes the spec names were read in both languages: ordered imports with unsupported entries, no
`imports` key, an empty `imports` list, a `_` match file (inspector sentence and sidebar mark) and a `_`
configuration profile (the neutral sentence and its mark). Four match 3-9-1 as drawn. **One drawn result
contradicted 3-9-1 (F1, §5 item 1): the list's position numbers were drawn only beside unsupported entries.**
The review made it a closure blocker; it was fixed and re-read in both languages (§8, launches L04 and L05),
and all five positions are now drawn. The sidebar tooltips were **not read** (§4).

The configuration was synthetic and neutral, written for this phase (§2), copied per launch under
`/private/tmp/3-9-2/L<n>/xdg/espanso/`, reached through `XDG_CONFIG_HOME` with `HOME` also pointed into the
scratch tree. The owner's configuration was never reachable. Captures stay in `/private/tmp/3-9-2/`,
following 3-8-3's precedent; none is in the repository.

## 2. The instrument (ruling 30) — uncommitted, deleted after the review

A new, untracked directory; **no tracked file was edited to host it**, and it was never `git add`ed. It
follows 3-8-3 notes §2: the build wraps the tracked Vite configuration and injects one module into
`index.html` at build time; the language is read from a synthetic marker file's name in the sidebar, so no
Rust, IPC or `src/` change was needed. **No temporary hook in `src/` exists.** It stayed in the tree through
this phase's single review and the F1 recapture, and was then deleted from the repository root with
`rm -r instrument-3-9-2`. Its files, as they were:

| Path | SHA-256 | What it is |
|---|---|---|
| `instrument-3-9-2/vite.config.ts` | `5b0455266b5d0de74d019afeed727696af95cc553034227e5a911b21a942a124` | wraps `../vite.config.ts`, adds a `pre` `transformIndexHtml` plugin injecting `probe.ts` before `src/main.ts` |
| `instrument-3-9-2/probe.ts` | `de0e7615c2842a7d29ebc81b1b5ecd602e65b7b5708994515f38b9c13a7f264d` | the page driver: picker, sidebar rows by file name, the DOM line (compares page text with `src/lib/i18n/{en,es}.json`), the badge |
| `instrument-3-9-2/probe.css` | `9fc989adcb30d28dd2d6236722855fae1bd5e6b0a1c2210c1f610876dee92ae2` | the badge's stylesheet (the app's CSP ignores a `style` attribute) |
| `instrument-3-9-2/launch.sh` | `0b05b412929e420be451d7acd84b97e3031876a75714286945b48188cfae3d95` | one launch: scratch tree, fixture copies, marker file, fresh bundle copy, `open -n --env`, lock checks, captures, quit, disk compare |
| `instrument-3-9-2/winid.swift` | `04f8813b2d5d4d47dc3f4b6f06673d90d4f27499478efe460d5668336e612666` | prints the app's CoreGraphics windows (id, layer, on screen, size, title) for `screencapture -l` |
| `instrument-3-9-2/config/default.yml` | `7b99dab8d955c5f75c52ad96a4933e29a1c0520fa8b18ea1142c9ec5bbb78cdb` | synthetic `config/default.yml` (one comment line) |
| `instrument-3-9-2/config/_neutral-profile.yml` | `0e0cbcfbb1dcaeb82d32d2da392cf33a69bf193b123919f5c9a0480543fe87fe` | synthetic `_` configuration profile |
| `instrument-3-9-2/match/imports-listed.yml` | `555e1bc019ac8223adf840e0ed33dcfd05ace0ec482be45fa8eaf18a210b2f34` | five imports: three scalars (one single-quoted), a flow sequence, a flow mapping |
| `instrument-3-9-2/match/imports-absent.yml` | `4de6173272bfd68af437c4fe5299178fb74b0d0bc45b00bc1646d51375873e12` | no `imports` key |
| `instrument-3-9-2/match/imports-empty.yml` | `1c1457d7c42ecef5b0d6dd84e87e7f5d6f5a99f8dd1210feb775f24c737e0633` | `imports: []` |
| `instrument-3-9-2/match/_not-auto-loaded.yml` | `dbbab9efd3324ab479ebef58a6777ae8d61af04761e58f33438224952917623b` | synthetic `_` match file |

Outside the repository: `/private/tmp/3-9-2/winid` (compiled from `winid.swift`,
`b91d993ae16a0d14ab5e2badf84ae131746b9effd8e000b62c29d043bf5843ee`), the scratch trees
`/private/tmp/3-9-2/L01` … `L05` (each with its bundle copy, `caps/`, `small/`, `launch.txt`, `before/`,
`xdg/`, `home/`, and the crops named in the reading), the Rust test log `/private/tmp/3-9-2/cargo.log`, and
the build logs `/private/tmp/3-9-2/build.log`, `build2.log`, `build3.log`, `plain-build.log`.

**Build:** `npx tauri build --debug --bundles app --config
'{"build":{"beforeBuildCommand":"npx vite build --config instrument-3-9-2/vite.config.ts"}}'` (209 modules: the
tracked 207 plus `probe.ts` and `probe.css`), built three times: binary A (L01; badge over the picker), binary
B (L02, L03; badge moved), binary C (L04, L05; the same instrument over the F1 fix). The instrumented bundle lives in the gitignored `target/debug/bundle/` and must
not be read as a plain build. `dist/` was then rebuilt with the plain `npm run build` (207 modules; the probe's
strings `probe-392` and `392 t=` are absent from `dist/`; server-only oracle absent, client-only oracle 2).

## 3. Launches and the lock state per launch

`IOConsoleLocked` read `No` at 12:35 (the orchestrator) and at this phase's start. Lock state was then read with
`ioreg -n Root -d1` before each launch, before every capture and after each launch (`launch.txt`). **Every
reading was `"IOConsoleLocked" = No`**; no capture was stopped for a lock.

| Launch | Plan | Lang | Window | Captures | Status |
|---|---|---|---|---|---|
| L01 | walk | EN | 9758 | 36 (12:38:29–12:39:19) | exploratory, not credited (the badge covered the picker) |
| L02 | walk | EN | 9769 | 36 (12:40:09–12:40:59) | read |
| L03 | walk | ES | 9780 | 36 (12:41:05–12:41:55) | read |
| L04 | walk | EN | 9792 | 36 (12:50:02–12:50:53) | read — F1 recapture, binary C |
| L05 | walk | ES | 9803 | 36 (12:50:57–12:51:47) | read — F1 recapture, binary C |

Each launch's `disk:` line reads `fixtures unchanged`.

## 4. The rows (a model's look; never mounted evidence, never a hidden page)

Paths are `/private/tmp/3-9-2/L<n>/small/cNN.png` unless named; the DOM lines are quoted in the reading.

| Shape | EN | ES | Against 3-9-1 |
|---|---|---|---|
| (1) Ordered imports with unsupported entries | **read** — L02 `c03`, crop `L02/cmp-list.png` | **read** — L03 `c03`, crop `L03/cmp-list.png` | order, all five entries, the two reasons in place, the "not looked up" sentence, the quote-style marker: match. **Numbering: contradicted (F1)** — only `2.` and `4.` drawn. **After the fix: all five positions `1`–`5` drawn**, L04 `c03` (EN) and L05 `c03` (ES), crops `L04/cmp-list.png`, `L05/cmp-list.png` |
| (2) No `imports` key | **read** — L02 `c08` | **read** — L03 `c08` | matches |
| (3) Empty `imports` list | **read** — L02 `c12` | **read** — L03 `c12` | matches; drawn distinct from (2) |
| (4) `_` match file: inspector sentence and sidebar mark | **read** — L02 `c16`; mark crop `L02/cmp-sidebar.png` | **read** — L03 `c16`; `L03/cmp-sidebar.png` | matches; no "inactive" |
| (4) `_` match file: sidebar tooltip | **unread** — DOM only: `title` equals the explanation | **unread** — same | not read (a native `title` tooltip needs real pointer hover, §4.1) |
| (5) `_` configuration profile: neutral sentence and mark | **read** — L02 `c20` | **read** — L03 `c20` | matches; no loading claim |
| (5) profile tooltip | **unread** — DOM only | **unread** — DOM only | not read |

**ES fit.** Nothing was seen clipped in Spanish; the longer sentences wrap inside the inspector's block.

**Unread, and why:** both tooltips (above); real keyboard and pointer input on every control (§4.1 reserves it to
a person); the `notRead` and `unsupportedShape` states and an entry holding a line break or `\r` (not in this
phase's shape list); layout acceptance and wording clarity (a person's judgement).

## 5. Open items (noticed, not fixed here)

1. **F1 — the imports list's position numbers were not drawn beside source-text rows — FIXED in this phase
   (§8).** Seen in L02 `c03`, L03 `c03`, also L01 `c05`, EN and ES: `FileScope.svelte` relied on the
   browser's `<ol>` numbering, but the window drew `2.` and `4.` only; rows 1, 3 and 5, drawn through
   `SourceText`, carried no number, while the DOM held five `<li>`. Probable cause, from a code reading and
   **not verified**: `SourceText`'s root is a block `div` with `white-space: pre; overflow-x: auto` as the
   `<li>`'s first child, beside which WebKit draws no outside marker. The fix no longer depends on the marker,
   so the cause was not pursued.
2. **The file's findings block words an elided import entry as the key's shape** (L02/L03 `c03`: *The key
   “imports” holds a list, which is not the shape espansoConfig's model allows there.* and *… holds a set of
   keys …*), while the key itself does hold a list; the offending values are entries inside it. That block is
   `findings.ts`', not 3-9-1's; a wording question for the owner or a later phase.
3. **A `_` configuration profile's detail pane offers *Add a snippet*** (L02 `c20`, L03 `c20`: *Añadir un
   fragmento*), beside *There are no snippets here.* Not 3-9's surface (D3 left the detail pane unchanged);
   whether a profile should offer it was not examined.
4. Carried, not this phase's scope: `3-9-1-notes.md` §4 item 2 (espanso's handling of `_` profiles,
   unverified) and item 3 (an entry holding a line break or `\r`, no fixture).
5. Unread and owed to a person if wanted: the two sidebar tooltips, EN and ES (§4).

## 6. Deviations

- **L01 was exploratory** and is not credited: the badge sat over the header's language picker. The badge was
  moved to the bottom right and the bundle rebuilt; L02 and L03 used the second binary.
- **One plan, five files per launch** rather than one launch per shape: the plan (set the language through
  the picker, then scope the list to each synthetic file in turn) is the same in every launch, and one launch
  per language carries all five shapes.
- The fixtures are **new synthetic files** in the instrument, not byte copies of corpus fixtures: no committed
  fixture holds an unsupported import entry, an empty list, a `_` match file and a `_` profile together.

## 7. Gates (after the F1 fix, with the instrument moved out of the repository)

The instrument directory was moved outside the repository for the gate run, so the gates saw the tree as it
would be committed; it was moved back only for the recapture build and then deleted.

| Command | Exit | Result |
|---|---|---|
| `cargo test --workspace -- --test-threads=1 > /private/tmp/3-9-2/cargo.log 2>&1` | 0 | 33 `test result: ok` lines, 1465 passed, 0 failed |
| `cargo clippy --workspace --all-targets -- -D warnings` | 0 | |
| `cargo fmt --check` | 0 | |
| `npm run check` | 0 | 474 files, 0 errors, 0 warnings |
| `npm test` | 0 | 80 files, 3824 passed (+2: the new position case, once per locale) |
| `npm run build` | 0 | 207 modules; server-only oracle absent; client-only oracle 2 |

**Rung: `1465 / 474 / 3824 / 207`** (previous `1465 / 474 / 3822 / 207`). After the recapture build, `dist/`
was rebuilt with the plain `npm run build` (207 modules, no probe string in `dist/`).

## 8. Review and the F1 fix

The phase's single review (Codex, `docs/reviews/phase-3-9-2.md`) answered **ship-with-fixes** with one
SHOULD-FIX: F1 must be fixed before step 3-9 closes.

**The fix, in `src/lib/components/FileScope.svelte`.** Each `<li>` now draws its own position as a digit in a
`<span class="position">` holding `row.position` (the model already carried the 1-based position; `fileScope.ts`
is unchanged), and the row's content moves into a `<div class="entry">`. The `<ol>` keeps its list semantics
but draws no marker (`list-style: none`); each row is a two-column grid (`1.25rem minmax(0, 1fr)`) with the
entry cell at `min-width: 0`, so `SourceText`'s own horizontal scrolling is unchanged. `SourceText` itself is
untouched. The number is a bare digit, so no dictionary key was needed.

**The test, in `src/lib/components/FileScope.test.ts`.** A new case per locale mounts the inspector over a
five-entry mixed list (scalar, elided sequence, scalar, elided mapping, scalar) and asserts that every row's
direct `.position` child reads `1` … `5` in order, that rows 1, 3 and 5 are the ones drawn through `SourceText`,
and their texts. The existing order case now reads the unsupported reason from `.entry` rather than the whole
row, which also holds the number.

**The recapture.** `IOConsoleLocked` read `No` before the launches. Binary C (the same instrument over the
fixed tree) was launched once per language, each at a fresh bundle path with the language set through the
picker: **L04 (EN)** and **L05 (ES)**, lock `No` before, at every capture and after, fixtures unchanged. In
L04 `c03` and L05 `c03` (crops `L04/cmp-list.png`, `L05/cmp-list.png`) the inspector for
`imports-listed.yml` draws **`1` through `5`**, one beside each entry, the three source-text rows included, in
file order, with the rest of the block as L02/L03 drew it. The tooltips stay **unread**.

After the recapture the instrument was deleted with `rm -r instrument-3-9-2`.
