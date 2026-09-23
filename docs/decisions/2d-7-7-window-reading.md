# Phase 2d-7-7 — R38: the fifteen byte-exact fixtures in the raw viewer (window reading)

**Date:** 2026-09-23.
**Spec:** [`2d-7-split-notes.md`](2d-7-split-notes.md) §2 *2d-7-7*, bound by §3 entries 22 and 34 (and
16, 18 and 35 as cited). What was done and why, the inventory, the acceptance clause by clause, the
deviations and the open items are in [`2d-7-7-notes.md`](2d-7-7-notes.md).
**Instrument:** frozen. The four instrument paths and the fourteen harness files equal
[`2d-7-4-2-notes.md`](2d-7-4-2-notes.md) §5.3 and `/private/tmp/2d7-instrument-reviewed/SHA256SUMS`,
18 of 18, before the first launch (16:56:44) and after the gates (17:04:43) (notes §1).
**Binary for every launch** (`R38-01` … `R38-18`, each launch's `binary.sha256`):
`53d84fb2f2060d03db217cd5381dbaceb884fa1fc236c99b6ce481e0adaa510b`, the binary 2d-7-4-2 §9.6 built. It
was not rebuilt.
**Harness:** `/private/tmp/espansoconfig-harness-2d-6-6c-2/launch-7.sh`, `5d5f6397…82ec`.

The claims rest on:
- eighteen launches, each on its own bundle path and bundle identifier, and their transcripts
  (`launches/R38-*/probe.log`, `launch.txt`, `bytes.txt`);
- the probe's reconciliation of Rust's tallies against the page's recorded commands (entry 15);
- two out-of-app comparisons of the viewer's text against the bytes: this step's
  `/private/tmp/2d7-7-compare.cjs` (output `/private/tmp/2d7-7-compare.txt`), which also produces the
  four SHA-256 values, and the frozen `tools/verbatim-9c.cjs` as an independent cross-check (outputs
  `/private/tmp/2d7-7-verbatim9c-R38-*.txt`);
- one window capture looked at by the worker (§5).

**The screen read unlocked at every recorded check.** Every preflight and every `lock-at-end` read
`lock=unlocked` (`rule=primary-unlocked-and-cross-check-not-locked`, `CGSSessionScreenIsLocked=absent`),
all 72 recorded beats (4 per launch) read `visibility=visible focus=yes`, and all 18 captures are
`used=window` (`screencapture -l`). **No launch ran with `:keepalive`**, because entry 18 forbids it in a
visible launch; every launch reached its terminal line without it. Entry 18's three conditions were
**observed at the sampled instants only**; nothing is claimed between samples. "Drawn" below means
**present in the DOM** of the viewer's `SourceText` box; the one visual look is §5's.

---

## 1. The launches

All eighteen: `launch-7.sh launch raw-open-crlf:<en|es> <name> --config config-crlf-bom-r0.yml --conflict
<fixture>`. `raw-open-crlf` is the only frozen plan that opens the raw **viewer** over
`match/conflict.yml`, prints its text as a `--- disk` line and takes no other action (notes §2).
`config/default.yml` is the harness's synthetic CRLF+BOM config `config-crlf-bom-r0.yml`
(`ae83223f…f535`, 120 bytes; `get_document` reported `line_ending: Crlf`).

| Launch | Lang | Fixture staged as `match/conflict.yml` |
|---|---|---|
| R38-01 | EN | `crlf-line-endings.yml` |
| R38-02 | EN | `bom-utf8.yml` |
| R38-03 | EN | `no-trailing-newline.yml` |
| R38-04 | EN | `unicode-offsets.yml` |
| R38-05 | EN | `block-scalars.yml` |
| R38-06 | EN | `block-scalar-terminal-spaces.yml` |
| R38-07 | EN | `block-scalar-leading-blank-lines.yml` |
| R38-08 | EN | `folded-more-indented.yml` |
| R38-09 | EN | `block-scalar-header-tails.yml` |
| R38-10 | EN | `file-comments-and-mixed-endings.yml` |
| R38-11 | EN | `single-line-no-line-ending.yml` |
| R38-12 | EN | `run-based-removal-boundaries.yml` |
| R38-13 | EN | `move-block-scalar-seams.yml` |
| R38-14 | EN | `move-run-joins.yml` |
| R38-15 | EN | `move-kept-comment-joins-a-block.yml` |
| R38-16 | ES | `crlf-line-endings.yml` |
| R38-17 | ES | `unicode-offsets.yml` |
| R38-18 | ES | `file-comments-and-mixed-endings.yml` |

Started 16:58:47 (R38-01) … 17:01:26 (R38-18). Every launch: exit 0, `reached-terminal=yes
alive-at-kill=yes`, one `--- end`, `failed-lines=0`, `reconcile-lines=2 void-lines=0` (both
`commands=equal(except-plugin:event) … probe-half=ok emitted=0 delivered=0`), `--- instrument ok
probe-commands=14 page=14`, `probe.err-bytes=0`, `home-files=0`, `script-writers=0`,
`lsappinfo-bundle-id` equal to its own `cc.carpio.espansoConfig.probe.R38-NN`, language set through the
picker (`--- language picked=<en|es> lang=<en|es> label=ok`), clipboard untouched (`copies=no`,
`changeCount` unchanged), `sourcetext crlf-viewer boxes=1 [file]`. **No launch was voided or re-run.**

---

## 2. The four SHA-256 values per fixture

Source = `crates/espansoconfig-core/tests/corpus/synthetic/<fixture>`; copy = the harness's
`fixtures/<fixture>` (imported against `fixtures-7.manifest`; `stage_fixture` also re-hashed the staged
copy against the manifest); launch-before = `launches/<name>/xdg-before/espanso/match/conflict.yml`
(the tree copy taken before `open`); launch-after = `launches/<name>/xdg/espanso/match/conflict.yml`
after the process was killed. **In every launch all four are equal**, so source = copy holds and no
launch is void. The value per fixture (each of the four):

| Fixture | SHA-256 (source = copy = launch-before = launch-after) | Launches |
|---|---|---|
| `crlf-line-endings.yml` | `bc010c851c76d17071ff8fa93925ef655c272b8556146724a786dacf7614a0f8` | R38-01, R38-16 |
| `bom-utf8.yml` | `5b2f9cf290dd552499a69199ecae13f3f17680e0b8d22aec1975a6651c30cf30` | R38-02 |
| `no-trailing-newline.yml` | `ab5c8c6d0ddab084014deda499607d6cec1b6e572ae6828aa5ec42dba516eb13` | R38-03 |
| `unicode-offsets.yml` | `9c07dd136fccdb2656ad08e2c4eff794fc8583209c4577d19b6d2e9b2d0e8083` | R38-04, R38-17 |
| `block-scalars.yml` | `cdbd52d8cb92611b784ff1795a4fcf4a7f0a0f93979840cc48552845a5f1a924` | R38-05 |
| `block-scalar-terminal-spaces.yml` | `093a6d657acf24f2b0b4ed8bdf6e02d1eb79a28e85414abb9d7114ef642a4bb2` | R38-06 |
| `block-scalar-leading-blank-lines.yml` | `866d6e961800566d6fa1065257250f248eb7fef45b71a09454a94e01d484b4c6` | R38-07 |
| `folded-more-indented.yml` | `43f545eecdb12fdf27de158e6d140d837c360c4a00a863099cd50d4cd7812c9a` | R38-08 |
| `block-scalar-header-tails.yml` | `58f5f269965e569c82ddd51ccdd4e14534eddc0398cf260944314f6a08230f11` | R38-09 |
| `file-comments-and-mixed-endings.yml` | `f6c883cd52958b285dd1b0e8993ff9ffba8b50f3a0f15e8e111d38782058efc4` | R38-10, R38-18 |
| `single-line-no-line-ending.yml` | `864e613a599fa1fdcec39dbebbf58aaad37c2ee693b29cd1ccdf98aa250a09c2` | R38-11 |
| `run-based-removal-boundaries.yml` | `be1e1a8df75c42d2c0eae7a7aaa1ca97d74d78b667a7a856206a676ca9a7e719` | R38-12 |
| `move-block-scalar-seams.yml` | `31a3358e4e00cf89d97e2ed983f28439fdaed4c85b9689fccdb7f6cdb0c9e7ab` | R38-13 |
| `move-run-joins.yml` | `1b29e99989fee530f2bcd982ba16e83787bb0c36db2dc25883be456570d4754e` | R38-14 |
| `move-kept-comment-joins-a-block.yml` | `2d8ebf5650ca173045191fa19ab2a3e4bf8704b8da09efa00f88526be8768f95` | R38-15 |

Each value also equals the fixture's `fixtures-7.manifest` line. The per-launch lines, each hash
printed separately, are in `/private/tmp/2d7-7-compare.txt`. **launch-after equals launch-before
because no external change was made** (notes §3, clause 3): it pins that the launch left the fixture's
bytes alone, not a successor.

---

## 3. The viewer's text against the bytes, out of the app

`2d7-7-compare.cjs` decodes the fixture strictly as UTF-8 (BOM kept as U+FEFF) and holds it against the
JSON of the `--- disk crlf-viewer` line, which is the viewer box's DOM text with each `<br>` read as
`\n` and each named-invisible marker read as `⟦label⟧` (`sourceTextOf`, `src/probe.ts`). It reports the
first of: `EXACT`; exact except that each CRLF is drawn as one break; exact after decoding each marker's
`U+XXXX` back to its character; both. Anything else would be `DIFFERS` with the first offset. **No
fixture differed.**

| Launch | Fixture | Shape (bytes / chars; CRLF / bare LF; BOM; final newline) | Verdict | `verbatim-9c` cross-check |
|---|---|---|---|---|
| R38-01 / R38-16 | `crlf-line-endings.yml` | 375 / 373; 13 / 0; no; yes | **exact except each CRLF drawn as one break** (360 chars drawn) | `crlf-as-one-break` |
| R38-02 | `bom-utf8.yml` | 276 / 267; 0 / 7; **yes**; yes | **exact after marker decoding**: one marker, `byte order mark U+FEFF`, at offset 0 | `MATCHES-NO-FIXTURE` (the tool has no BOM-marker mode; not a difference) |
| R38-03 | `no-trailing-newline.yml` | 214 / 212; 0 / 4; no; **no** | **EXACT** | `exact` |
| R38-04 / R38-17 | `unicode-offsets.yml` | 306 / 302; 0 / 6; no; yes; **not NFC** | **EXACT** — the decomposed sequence was not normalised | `exact` |
| R38-05 | `block-scalars.yml` | 2346 / 2346; 0 / 87 | **EXACT** | `exact` |
| R38-06 | `block-scalar-terminal-spaces.yml` | 712 / 712; 0 / 18; no; **no** | **EXACT** (trailing spaces before EOF kept) | `exact` |
| R38-07 | `block-scalar-leading-blank-lines.yml` | 1581 / 1581; 0 / 49 | **EXACT** | `exact` |
| R38-08 | `folded-more-indented.yml` | 1636 / 1636; 0 / 45 | **EXACT** | `exact` |
| R38-09 | `block-scalar-header-tails.yml` | 728 / 728; 0 / 20 | **EXACT** | `exact` |
| R38-10 / R38-18 | `file-comments-and-mixed-endings.yml` | 815 / 815; **2 / 17**; no; **no** | **exact except each CRLF drawn as one break** (813 chars drawn) | `crlf-as-one-break` |
| R38-11 | `single-line-no-line-ending.yml` | 55 / 55; 0 / 0; no; **no** | **EXACT** | `exact` |
| R38-12 | `run-based-removal-boundaries.yml` | 1131 / 1131; 0 / 26 | **EXACT** | `exact` |
| R38-13 | `move-block-scalar-seams.yml` | 1989 / 1985; 0 / 36 | **EXACT** | `exact` |
| R38-14 | `move-run-joins.yml` | 1848 / 1848; 0 / 41 | **EXACT** | `exact` |
| R38-15 | `move-kept-comment-joins-a-block.yml` | 1645 / 1645; 0 / 37 | **EXACT** | `exact` |

**What "one break" means here, and its limit.** `SourceText` draws a CRLF as one `<br>`, by design
(`src/lib/components/SourceText.svelte`; `sourceSegments` in `src/lib/browser/sourceText.ts`), and the
viewer says so in its caption ("every line ending is drawn as one line break"). The DOM therefore
cannot show which breaks were CRLF and which LF: for the two CRLF-bearing fixtures the comparison
proves every character and every break position, **not** the ending of each break. No lone `\r`
exists in any of the fifteen, so no `carriage return` marker was drawn (the plan's `absent` sentence
agrees in all 18 launches).

---

## 4. What each fixture was drawn in, and the panel or refresh half

- **Drawn in: the raw viewer only** — the detail pane's file text (`section.detail >
  section:not(.rawEditor):not(.restore) div.sourceText`, reached by the sidebar row and *Show this
  file's text*), every fixture, EN; three also in ES. **No fixture was drawn on a conflict panel or on
  a viewer refresh.**
- **Panel or refresh line: UNREAD for all fifteen**, because no external change was made to any of
  them: the frozen instrument has no successor fixtures and no plan that asks for one (notes §2, §3).
  This is the clause the step stops `BLOCKED` on.
- **`writes=0`**, as a **whole-launch labelled observation** (S5), every launch: `--- span start→end
  writes=0 write-commands=[] emitted+=0 delivered+=0 witness=unchanged(except none)`, Rust's
  `rust-writes=0` at both checkpoints, and an empty out-of-app `diff -rq xdg-before xdg`. These plans
  have no writer of any kind, so the `except` list is empty; it is still not cited as an entry-16
  per-action witness (notes §3).
- **The raw editor's control over the viewer** (the plan's own lines, recorded, not a finding):
  `rawEditorOpen=absent` and `browser.rawEditor.lineEndingsNotPreserved` drawn for the two
  CRLF-bearing fixtures (R38-01, -10, -16, -18); `rawEditorOpen=present` and that sentence not drawn for
  the thirteen others, `bom-utf8.yml` included. `raw-open-crlf` was written for a CRLF file, so on the
  thirteen its two CRLF expectations print `MISMATCH` (`lineEndingsNotPreserved expect=present drawn=no`,
  `rawEditor.open expect=absent drawn=yes`); `verbatim-9c` agrees with the page's `drawn` on each
  (`agrees`), and counts exactly those two as its `problems=2`. Entry 22 bars any claim about a raw
  **editor** over `\r`; none is made.

---

## 5. Languages and the one look

- **EN:** all fifteen (R38-01 … R38-15).
- **ES:** `crlf-line-endings.yml`, `unicode-offsets.yml`, `file-comments-and-mixed-endings.yml` (R38-16 …
  R38-18). Their disk verdicts equal their EN twins'. `verbatim-9c` read every `--- sentence` line against
  `es.json` with the language taken from the `--- language picked=es` line: R38-16 and R38-18 `problems=0`,
  R38-17 `problems=2` (the two CRLF expectations above, `agrees`), `not-found=0` and `residues=[]` on all
  three.
- **One capture looked at:** `R38-10/shots/crlf-viewer-window.png`. It is the app's own window, not the
  lock screen: the sidebar with `match/conflict.yml` selected, the *File text* section with the
  line-endings refusal and *Replace this file's text from a backup entry*, and the file's text in the
  monospaced box. Every other visual claim is **unread** and stays 2d-7-9's. No `*-screen.png` exists
  for these launches (window captures only, entry 34) and none was quoted or copied.

---

## 6. What this reading does not show

- **Any conflict panel or viewer refresh over the fifteen** (§4).
- **The ending of each line break** in the two CRLF-bearing fixtures (§3).
- **An edit's byte-exactness, sends not made, or anything about a raw editor over `\r`** (entry 22).
- **A per-action no-write witness** (S5): `writes=0` is whole-launch, labelled as such.
- **Visual judgements** beyond the one look in §5.
