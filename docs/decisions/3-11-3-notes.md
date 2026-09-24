# Phase 3-11-3 — Bulk selection: the window half

**Spec:** `docs/decisions/3-split-notes.md` §2 *3-11* and its 2026-09-24 addendum (the 3-11-3 bullet), ruling 30,
ruling 31 (one R38 touch), §4.1; `docs/decisions/3-11-2-notes.md` §1 (what the components draw).
**Risk:** high. The launch-by-launch reading is [`3-11-3-window-reading.md`](3-11-3-window-reading.md). This phase
closes step 3-11.

**No tracked source file changed.** The phase adds two records under `docs/decisions/` and one review brief under
`docs/reviews/`. The uncommitted instrument (§2) was deleted before the review.

---

## 1. What changed, and why

Step 3-11's window half (ruling 30) was taken on 2026-09-24 between 15:08:57 and 15:13:29, on an unlocked screen
(`"IOConsoleLocked" = No` at the phase's start, before each launch, before every one of the 160 captures and after
each launch), by a model reading `screencapture -l <window>` captures of the real Tauri window, in English (L01)
and Spanish (L02) with the language set through the in-app picker in each launch. Per §4.1 this is **a model's
look**, recorded as one; no owner judgement was sought or is claimed. Every action on the page was a
**script-dispatched DOM event**, not real input. Mounted jsdom evidence (3-11-2 §4) is not credited here as a
screen.

**A partial success was read in both languages, and on disk.** Five snippets in four files were selected; the
first apply was refused in the preflight for one file's acknowledgeable suspicion (*No file was written*, the
consent review drawn); after *Confirm for this file* the second apply **saved two files**, **failed one** (a real
environment failure: its directory was made unwritable before launch, so the temporary file could not be created)
and **left one file out** (a read-only snippet — the R38 touch). The headline, the execution counts and the
exclusion counts were drawn in two separate lists, and `disk.diff` shows exactly the two saved files changed.

Everything the phase owes was drawn and read in both languages except the rows in §3 marked unread. Three
candidate defects were seen (§5 items 1–3); none was fixed here.

The configuration was synthetic and neutral (§2), copied per launch under `/private/tmp/3-11-3/L<n>/xdg/espanso/`,
reached through `XDG_CONFIG_HOME` with `HOME` also pointed into the scratch tree. The owner's configuration was
never reachable, and `~/Library/Application Support/espanso` and `~/.config/espanso` were never touched. Captures
stay in `/private/tmp/3-11-3/`; none is in the repository.

## 2. The instrument (ruling 30) — uncommitted, deleted before the review

A new, untracked directory `instrument-3-11-3/` at the repository root; **no tracked file was edited to host it**,
it was never `git add`ed, and **no temporary hook in `src/` exists**. It follows 3-9-2 notes §2 and 3-8-3 notes §2
(whose sources were deleted with their phases and had to be rebuilt): the build wraps the tracked Vite
configuration and injects one module into `index.html` at build time; the language is read from a synthetic
marker file's name in the sidebar; the apply is held by wrapping `window.fetch`, Tauri's IPC transport on macOS.
It was deleted from the repository root with `rm -r instrument-3-11-3` after both launches and before the gates
and the review. A byte copy is kept outside the repository at `/private/tmp/3-11-3/instrument-copy/instrument-3-11-3/`
for a later window half to rebuild from. Its files, as they were:

| Path | SHA-256 | What it is |
|---|---|---|
| `instrument-3-11-3/vite.config.ts` | `b5ad03f8db7cf9e33cacc196bb68988419d15da9d43e1cf17e3f9bb45d5699f2` | `probeConfig(env)`: calls `../vite.config.ts`'s function and `mergeConfig`s one plugin whose `transformIndexHtml` (`order: 'pre'`) inserts `<script type="module" src="/instrument-3-11-3/probe.ts">` before `src/main.ts` |
| `instrument-3-11-3/probe.ts` | `4368cabb9b30d06d9d0bb1415ac9b533b03bdb7a416df66b0255ce10678738ac` | the page driver: wraps `window.fetch` to hold `apply_bulk_options` for `holdMs`; waits for the marker row; finds buttons by exact dictionary text (imports `src/lib/i18n/{en,es}.json`), rows by `.trigger` text, options by `li.option[data-option]`; `change` on `<select>`s; `scrollIntoView` before each reading; the badge and the DOM line (reading §*The badge*) |
| `instrument-3-11-3/probe.css` | `2cd9ca3aac9982f788122052a9946034c0efac5415cb8255edb771da5d2b2b71` | the badge's stylesheet (the app's CSP ignores a `style` attribute): fixed, bottom-left, 30vw, yellow, 9 px Menlo |
| `instrument-3-11-3/launch.sh` | `1be1766495cf8c8388a31f83d1eefcbe81684b2a9a33e54e98fa094803b2a9a1` | one launch (`<n> <lang> <captures>`): scratch tree, fixture copies, marker file, `before/` copy, `chmod 555 match/locked`, fresh bundle copy, `open -n --env`, window id from `winid`, lock check before every capture, `screencapture -x -o -l`, kill, `chmod 755`, `diff -r` into `disk.diff`, `sips -Z 1400` copies |
| `instrument-3-11-3/fixtures/config/default.yml` | `014c047116b6252a248001a3b6ef68f71095f1f8986dd46e9facd0369acc981a` | one comment line |
| `instrument-3-11-3/fixtures/match/bulk-alpha.yml` | `60e08a75198b4aed49b84f12f78859c0cb79f1cb49d76902676217e6d645e5c4` | `:alpha1` (`word: true`), `:alpha2` (`word: 'true'`), both `propagate_case: true` |
| `instrument-3-11-3/fixtures/match/bulk-delta.yml` | `4711c869550f2b8c186601981f5887565f1ef34a09159f6ee6bd0eaa512016ec` | `:delta1`, `replace` referring to an undeclared `{{nowhere}}` — the acknowledgeable refusal |
| `instrument-3-11-3/fixtures/match/bulk-gamma.yml` | `e6976641a1bbb0e89cfbd494b59c7ef9a4b54232b4794d5897b041abc38c4a42` | `:gamma1`, `replace: &shared …` — an anchored value, so not safely editable (the R38 touch) |
| `instrument-3-11-3/fixtures/match/locked/bulk-beta.yml` | `3180649ff615d96436d1dde915bd795218d6c6a28219b7f9f71f2c727f63935e` | `:beta1` (`word: true`), in the directory `launch.sh` makes unwritable — the execution failure |

**Why these fixtures give a partial success without injection.** The coordinator preflights every file without
touching the disk and writes nothing if any preflight refuses (`src-tauri/src/bulk.rs` module docs), so a refusal
alone never yields a partial; a partial needs a save that fails after an earlier one committed. The atomic write
creates its temporary file beside the target (`crates/espansoconfig-core/src/persist/write.rs`, step 6), so a
read-only directory fails that one file's save before its rename (`failed`, `may_have_written: false`), and the
run stops there. Request order is the order of first selection, so `:beta1` was toggled after the two files meant
to commit. Discovery walks `match/` recursively (`discovery.rs`, `collect_yaml_files`), so `match/locked/` is listed.

Outside the repository: `/private/tmp/3-11-3/winid` (a byte copy of 3-8-3's compiled helper, `winid <pid>` prints
`id layer onscreen WxH title` per window; `96d06e69b448038dcface5523843d09d911469ff322fdca716886b40b75878e3`, the
hash 3-8-3 recorded), the scratch trees `/private/tmp/3-11-3/L01` and `L02` (each with its bundle copy, `caps/`,
`small/`, `badge/`, `launch.txt`, `before/`, `xdg/`, `home/`, `disk.diff`), the comparison crops
`L01/cmp-toggle.png` and `L01/cmp-pending-list.png`, the listings `ls-before.txt` and `ls-after.txt`, and the logs
`build.log` (instrumented), `check.log`, `vitest.log`, `plain-build.log`, `gates.txt`.

**Build:** `npx tauri build --debug --bundles app --config
'{"build":{"beforeBuildCommand":"npx vite build --config instrument-3-11-3/vite.config.ts"}}'` (212 modules: the
tracked 210 plus `probe.ts` and `probe.css`), built once; both launches used that binary. The instrumented bundle
lives in the gitignored `target/debug/bundle/` and must not be read as a plain build. `dist/` was then rebuilt by
the plain `npm run build` gate (210 modules; the probe's strings `probe-3113` and `3113 ` are absent from
`dist/assets/`).

## 3. The rows classed (a model's look; never mounted evidence, never a hidden page)

Captures are `/private/tmp/3-11-3/L<n>/small/cNN.png`; L01 is EN, L02 is ES.

| Row | EN | ES | Against 3-11-2 |
|---|---|---|---|
| *Select several* toggle, single mode | **read** L01 `c04` | **read** L02 `c05` | matches |
| Toggle refused while an editor is open, with the sentence | **read** L01 `c11` | **read** L02 `c09` | sentence matches; **the disabled toggle is drawn identical to the enabled one** (0 differing pixels, §5 item 1) |
| Mode on: Stop, Clear, hint, count, `☐` rows | **read** L01 `c16` | **read** L02 `c15` | matches |
| Toggle rows: `☑`, *Selected* badge, count 5 | **read** L01 `c20` | **read** L02 `c18` | matches |
| The seven options, label and key, in order | **read** L01 `c20`+`c23` | **read** L02 `c18` (`word` … `uppercase_style`) + `c20` (`propagate_case` … `force_clipboard`) | matches |
| Mixed and the *left as it is* line | **read** L01 `c20` | **read** L02 `c18` (`word`, `propagate_case`), `c20`, `c32` (`propagate_case`) | matches; Mixed by spelling alone not isolated (reading §3) |
| Intents: *Set to* with box and suggestion, *Remove* | **read** L01 `c30` | **read** L02 `c35` | matches |
| Draft Undo / Redo and the draft-only sentence | **read** L01 `c34`, `c37` | **read** L02 `c32`, `c35` | matches (one step per choice) |
| Exclusion with its reason — **the R38 touch** (read-only selection) | **read** L01 `c26` | **read** L02 `c25` | matches |
| Plan counts, the `noChanges` blocker, grey Apply | **read** L01 `c26` | **read** L02 `c25` | matches |
| The no-disk-undo sentence | **read** L01 `c26` | **read** L02 `c25` | matches |
| Nothing-written answer with counts apart | **read** L01 `c44` | **read** L02 `c43` | matches |
| Consent review: verdict, finding, *Confirm*; then *Confirmed* | **read** L01 `c44`, `c51` | **read** L02 `c43`, `c49` | matches |
| Pending-apply lock (`bulkApplyPending`) | **read** L01 `c55` (inspector: *Applying…*, grey Apply; list: DOM disabled, press ignored) | **read** L02 `c54` | inspector matches; **the list draws no disabled state** (0 differing pixels, §5 item 1) |
| **Partial success**: headline, execution counts and exclusion counts apart, per-file lines | **read** L01 `c62` | **read** L02 `c60` | matches; disk agrees |
| An execution failure listed apart from exclusions | **read** L01 `c62` | **read** L02 `c60` | outcome sentence matches; **the command error's promised reason is not drawn** (§5 item 2) |
| Stale selection after commit blocks | **read** L01 `c62` | **read** L02 `c60` | matches |
| *Keep only the snippets that were not written* | **read** L01 `c71`, `c74` | **read** L02 `c72` | matches |
| Stop selecting; notice for the held single selection | **read** L01 `c77` | **read** L02 `c75` | notice is the external-change sentence (3-11-1 §5 item 1) |
| Real keyboard / pointer input on rows and controls | **unread** | **unread** | see below |
| Typing into a *Set to* box | **unread** | **unread** | see below |
| `emptyValue`, `nothingToApply`, `editorOpen`, `consentNotPossible`, `consentOutdated`, `readFailed` | **unread** | **unread** | see below |
| `conflicted`, `consentStale`, `blocked`, `writeOutcomeUnknown`, `alreadyUnchanged`, `notAttempted`/`failed` answers, `rereadFailed` | **unread** | **unread** | see below |
| Wording clarity, layout acceptance | **unread** | **unread** | see below |

**The exact screens and actions (ruling 31)** are in the reading, §4 (the bulk inspector in the detail pane, after
toggling the anchored `:gamma1` into the selection with *Select several* on).

**What 3-11's acceptance requires of the window, and whether it is met.** `3-split-notes.md` §2 *3-11* states one
window clause: *"Window half: EN and ES, including a partial success."* Ruling 30 requires a window half before
the step closes, taken per §4.1; ruling 31 requires one R38 touch of a read-only or excluded selection, with the
exact screen and action named. All three are **met**: both languages were read through the picker, the partial
success (two saved, one failed, one excluded) was read in each and agrees with the disk, and the read-only
exclusion was read in each (table above). The step's other acceptance clauses (only the seven options submittable,
an untouched Mixed control emits nothing, a stale selection blocks, open drafts respected, exclusions and
failures counted apart, draft undo and no disk undo promised) are carried by the model and mounted tests of
3-11-1 and 3-11-2; this reading **also saw** the stale-selection block, the toggle's refusal while an editor was
open, the counts drawn apart, draft Undo/Redo and the no-disk-undo sentence, and credits none of them beyond what
the captures show.

**Unread, and why** (none is required by 3-11's acceptance; each is an open item, §5 item 7, with the capability a
later reading would need):

- **Real keyboard and pointer input** on the rows and controls (Tab, Space/Return, the `aria-pressed`
  announcement): not required — the acceptance names languages and a partial success, not an input modality.
  Needs a person at the keyboard (§4.1 reserves real input to a person), or an instrument that synthesizes OS-level
  key events.
- **Typing into a *Set to* box**: not required. Needs a probe step that dispatches `input` events into the box
  (the probe used a suggestion button instead).
- **`emptyValue`, `nothingToApply`, `consentNotPossible`, `consentOutdated`, `readFailed`**: not required. Needs
  fixtures and probe steps that reach them: an emptied *Set to* box; a selection of only excluded snippets; a file
  with an editor-model error (for example two content fields); an intent changed after a refusal; a spelling read
  that fails (not reachable without injection).
- **`editorOpen`**: not required, and unreachable in this window (3-11-2 §5 item 2); the adjacent open-draft rule
  was read as the toggle's refusal (§3 above). A reading would need the exclusivity changed first.
- **`conflicted`, `consentStale`, `blocked`, `writeOutcomeUnknown`, `alreadyUnchanged`, the `notAttempted` and
  `failed` answers, `rereadFailed`**: not required — the one required outcome shape, a partial success, was read.
  Needs, per row: a disk change timed between the preflight and the lock; a consent sent for another candidate; a
  stale base revision; a failure after the rename; a selection already holding the values; a file dropped from the
  window before sending; a command-level rejection; a re-read that fails after a commit. Most need fault injection,
  which this phase's instrument did not have.
- **Wording clarity and layout acceptance**: not required by the acceptance; §4.1 reserves such judgements to a
  person.

## 4. The instrument was deleted — before/after evidence

`/private/tmp/3-11-3/ls-before.txt` (15:07:03, before the instrument was created) and `ls-after.txt` (15:14:54,
after `rm -r instrument-3-11-3`) each hold `ls -a` of the repository root and `git status --short`. `diff` between
them reports only the timestamp line: the root holds the same entries (`.claude`, `.git`, `.gitignore`,
`.nvmrc`, `48`, `Cargo.lock`, `Cargo.toml`, `CLAUDE.md`, `crates`, `dist`, `docs`, `en`, `es`,
`IMPLEMENTATION_PLAN.md`, `index.html`, `intro.md`, `LICENSE`, `node_modules`, `package-lock.json`,
`package.json`, `PROGRESS.json`, `PROGRESS.md`, `scripts`, `SIGN_AND_NOTARIZE.md`, `snippet`, `src`,
`src-tauri`, `svelte.config.js`, `target`, `tsconfig.json`, `vite.config.ts`, `whole`, and `.`/`..`), with no
`instrument-3-11-3`, and `git status --short --untracked-files=all` shows only ` M PROGRESS.json` (the
orchestrator's). `git diff --stat -- src src-tauri crates` is empty. The only build artifacts the instrument added
inside the repository were the gitignored `target/debug/bundle/` bundle and `dist/`, and `dist/` was rebuilt plain.

The empty directories `48/` (holding empty `badge/` and `small/`), `en/`, `es/`, `snippet/` and `whole/` at the
root predate this phase (dated 11:46, 3-8-3's launch window) and are invisible to git; see §5 item 6.

## 5. Open items (noticed, not fixed here)

1. **Candidate defect — the list draws no disabled state.** `SnippetList.svelte` styles no `:disabled` button, so
   the *Select several* toggle refused while an editor is open, and the list's *Stop*, *Clear* and every row
   during a pending apply, are drawn **pixel-identical** to their enabled selves (0 differing pixels, L01 and L02;
   crops `L01/cmp-toggle.png`, `L01/cmp-pending-list.png`). The refusal has its sentence; the pending lock is
   visible only in the inspector (*Applying…*, grey Apply). The DOM state is correct; a press does nothing. A later
   phase should decide whether the list draws its disabled controls as disabled.
2. **Candidate defect — a failed file's promised reason is not drawn.** The bulk file line for a `failed` outcome
   draws `tCommandError(line.error)`, whose `saveFailed` sentence ends *What it reports beside this is the
   reason.* / *Lo que informa junto a esto es el motivo.*, but `BulkInspector.svelte` draws nothing beside it (the
   nested save error is not rendered), so the sentence points at an absent reason (L01 `c62`, L02 `c60`). No
   claim about which layer should draw it is made here.
3. **Candidate defect or wording question — the *All* list reorders after a bulk commit.** Before the commit the
   list ran `:alpha1, :alpha2, :delta1, :gamma1, :beta1, :marker` (file order); after it, `:gamma1, :beta1,
   :marker, :alpha1, :alpha2, :delta1`, the re-read files moved last (L01 `c62`, L02 `c60`, and after stopping,
   `c77`/`c75`). Whether the *All* scope promises file order was not examined.
4. **Seen, already recorded elsewhere:** the file-text toggle stays drawn above the inspector (3-11-2 §5 item 1;
   L01 `c16`); the count keeps stale identities while re-projected rows draw `☐` (3-11-2 §5 item 3; L01 `c62`);
   after stopping, the app's own bulk commit is announced with the external-change sentence *This file changed on
   disk…* (3-11-1 §5 item 1; L01 `c77`, L02 `c75`). Whether a bulk-specific notice is owed stays open.
5. **Wording question for the owner:** in a *No file was written* answer the preflight-refused file is counted
   under the heading *Applied files* / *Archivos aplicados* (*Not written: 1*, *Not attempted: 2*; L01 `c44`),
   although no file was applied.
6. **Tree hygiene, not this phase's:** the empty root directories `48/`, `en/`, `es/`, `snippet/`, `whole/` (dated
   11:46, during 3-8-3's launches) look like debris from that phase's helper scripts. They are invisible to git and
   were left alone.
7. **Unread rows, not required by 3-11's acceptance, open for a later reading:** real keyboard and pointer input
   (a person), typing into a *Set to* box, the unreached blockers, consent states and file outcomes, and wording
   and layout judgements (a person). §3 names, per row, the capability a later reading would need.
8. **Carried unchanged:** 3-11-2 §5 items 2, 4, 5, 6; 3-11-1 §5 items 2, 5, 6, 7, 8; 3-10 §5 item 1 (quoted
   booleans in the single-snippet editor).

## 6. Deviations

- **One plan per language, not one launch per row:** both launches ran the same 24-step walk, which carries every
  owed row.
- **Mixed by exact spelling alone was not isolated** in the window (reading §3); the fixtures mix spelling and
  presence. The model test pins spelling alone.
- **The badge covers the footer's first words**; the footer's tail (*…face language: English*, *…de la interfaz:
  Español*) and the header picker were read instead.
- **The Rust gate was not run**: no Rust source changed and no Rust file was touched.

## 7. Gates (the tree as left, instrument deleted)

Each command's output went to a file under `/private/tmp/3-11-3/`, and its exit status was recorded in
`gates.txt` rather than read through a pipe.

| Command | Exit | Result |
|---|---|---|
| `npm run check` | 0 | 479 files, 0 errors, 0 warnings |
| `npm test` | 0 | 83 files, 3930 passed |
| `npm run build` | 0 | 210 modules; server-only oracle absent, client-only oracle 2; no probe string in `dist/` |

**Rung: `1505 / 479 / 3930 / 210`**, unchanged (the Rust figure carried from 3-11-2; not re-run, §6).
