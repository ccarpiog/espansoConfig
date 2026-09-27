# Phase 4-13 — Early authoring window half

**Spec:** `docs/decisions/4-split-notes.md` §2 *4-13*, ruling 29, §4.6 and §4.7; `3-split-notes.md` §4.1.
**Risk:** high. **Worker:** opus. The window reading is [`4-13-window-reading.md`](4-13-window-reading.md).
**Review:** `autoclaude-review.sh` exited 0 — **Codex**, no fallback: `ship-with-fixes`, 0 BLOCKERS + 1
SHOULD-FIX, fixed (§1.3; [`docs/reviews/4-13.md`](../reviews/4-13.md)).

## 0. The owner's rulings, verbatim (quoted before any change)

Given 2026-09-27 in the attended session, as answers to four multiple-choice questions after the owner's
own turn at the window; the chosen option's label is the ruling, and its description is quoted after it.

- **B5.** Asked *"B5 — the disk-version box cuts a long line mid-word at its right edge, with no visible
  scrollbar, and you could still read it by scrolling sideways. What should 4-13 do?"*, the owner chose
  **"Wrap long lines (Recommended)"** — *"Change the box to wrap lines so nothing is hidden. It's the one
  source change 4-13 is allowed, and it matches your clarity-first ruling. Nothing else changes."* (The
  other option was "Keep sideways scroll".) Before the question, having scrolled the box sideways in L09,
  the owner said: *"Yeah, I can read it."*
- **D15.** Asked *"D15 — every editor shows four empty grey boxes (Markdown content, HTML content, Image
  path, Form layout) for content kinds the snippet doesn't use. 'Form layout' is the one you mistook for
  the form's Layout. What's your ruling?"*, the owner chose **"Hide unused kinds (Recommended)"** —
  *"Draw only the content kind the snippet has. The 'Content kind' buttons stay as the way to switch.
  Carried to a later step; no change in 4-13."* (The others were "Keep, but collapse" and "Keep as they
  are".)
- **O3.** Asked *"O3 — the form builder's Spanish uses formal 'usted' ("Escriba primero…") and calls a box
  'casilla', while the rest of the app uses 'tú' and 'caja'. Which is right?"*, the owner chose **"Tú and
  caja everywhere (Recommended)"** — *"Align the form builder with the rest of the app. Carried to a later
  step as a wording fix; your native-speaker review (R35) still applies."* (The other was "Usted
  everywhere".)
- **O2.** Asked *"O2 — the 'Take out' button under each value is full-width in the variable group but
  compact beside the value in the form builder. Which should both use?"*, the owner chose **"Compact,
  beside the value (Recommended)"** — *"The form builder's way. Carried to a later step with O8–O10's
  visual-hierarchy work."* (The others were "Full width, below" and "No preference".)

**Owner judgements given during the session** (verbatim; recorded, not acted on in 4-13):

- **O8:** *"All the buttons at the top of the right side look confusing, there is not enough
  differentiation from the snippet content. It should be much clearer."* With it: *"Do nothing now, just
  take note."*
- **O10:** *"all text looks samey for a human, there is no clear way of finding sections, labels, etc.
  Clarity is paramount over design."* Recorded as **the owner's ruling on priority** for every later
  visual step: clarity over design. O8 and O9 are instances of it.
- The owner also asked that the tests run on the vertical display (§4 item 1).

---

## 1. What changed, and why

### 1.1 B5 — the disk-version box wraps, and marks every file line

**The measurement first** (§4.7): in L05/L06 the disk-version `SourceText` had `clientWidth` 423 and
`scrollWidth` 1832 under `white-space: pre`, so 1409 CSS px of a long line were hidden past the right edge,
cut mid-word, with no visible scrollbar (`4-13-window-reading.md` §3 row 8). The owner ruled to wrap.

**The premise the change had to keep.** `SourceText.svelte` did not wrap on purpose: *"A soft wrap is
indistinguishable from a line break the file does not contain."* The component suite pinned that
(`sourceText.test.ts`, *does not wrap…*), and `1c-2b-2b-1-notes.md`'s mutation I proved the test fails if
the container switches to `pre-wrap`. A plain `pre-wrap` would have broken that premise, so the change marks
lines instead:

- **`SourceText` takes an optional `wrap` prop, default `false`.** Without it the component draws what it
  drew before: the same segments, the same `<br>` per break, `white-space: pre`, the sideways scroll. The
  container is still one line of markup with no whitespace after its opening tag, which now reads
  `<div class="sourceText" class:wrap>{#each`.
- **With `wrap`, the segments and their `<br>` elements are drawn unchanged**, and before each segment
  that starts a file line the component adds one **empty** `<span class="lineStart" aria-hidden="true">`.
  Which segments start a line is the new pure function `startsFileLine()` in
  `src/lib/browser/sourceText.ts`: the first segment and every segment after a break. That matches what the
  `<br>` rendering shows: a trailing break opens no marked line, and a break after a break is an empty line
  with its own marker.
- **Each marker draws a `›` as CSS generated content** in an inline block 1.25rem wide, with
  `user-select: none`. The element holds no text, so the box's DOM text, and what a selection holds, is
  exactly the unwrapped box's. A visual row with no `›` is a soft-wrap continuation, never a line the file
  has.
- **This is the second shape; the review found the first one wrong** (§1.3).
- **`white-space: break-spaces; overflow-wrap: anywhere`** on the wrapping container: every space the file
  holds is kept and takes room (none hangs invisibly at a wrap), and a word with no space in it breaks
  rather than being cut at the edge. `overflow-x` becomes `visible`, since nothing is left to scroll.
- **One sentence under the box explains the marker**, `browser.source.wrapLegend` in both dictionaries:
  *"Each line of the file starts at a ›. A row without one continues the line above: the box wraps long
  lines, and the file has no line break there."* / *"Cada línea del archivo empieza con ›. Una fila sin él
  continúa la línea de arriba: la caja parte las líneas largas y el archivo no tiene ahí ningún salto de
  línea."* (*caja*, as the O3 ruling asks.) It is added because the owner ruled clarity over design (O10):
  a marker nobody explains is a mystery glyph.
- **Every disk-version box passes `wrap`**, nine call sites, one attribute each: `MatchEditor`,
  `MatchCreator`, `MatchDeleter`, `MatchMover`, `MatchDuplicator`, `RawEditor`, `RawSnippetEditor`,
  `RecoveryPanel` and `RestorePane`. They draw the same box under the same heading (*The version on disk*,
  or the raw editors' own disk-version heading); wrapping only the one measured would have left the same
  ruling half applied. **No other `SourceText` passes `wrap`**, and nothing in TypeScript forces a caller to
  choose either way; the component's header comment says so.

Byte faithfulness is unchanged: `sourceSegments` is untouched and the segments drawn are the same in both
modes, which the mounted suite pins (§1.2). CR handling is untouched: a CRLF is still one break, and a lone
`\r` is still a named invisible segment.

**The visible confirmation** (reading §3 rows 11 and 12): L10 (EN) and L11 (ES) on the first shape, and
L12 (EN) on the shape that shipped. Each reads `cw=423 sw=423 ws=break-spaces`: nothing is hidden,
continuation rows carry no `›`, and the legend is drawn.

### 1.2 Tests

`src/lib/browser/sourceText.test.ts`:

- A new suite, *where a file line starts, for a box that wraps*, with five cases for `startsFileLine`
  (the first segment and each one after a break, CRLF included; no marked line after a trailing break; an
  empty line between two breaks; nothing in empty text or outside the segments; a line that starts with an
  invisible character).
- The source scan *does not wrap…* is now **scoped to the default container's own rule** (it slices the
  `.sourceText {` rule), still refuses `pre-wrap` anywhere, and is renamed *does not wrap by default…*.
- A new source scan, *wraps only when asked, and then marks the start of every file line (B5)*: the prop
  defaults to `false`, the component calls `startsFileLine(segments, index)` and draws the empty
  `lineStart` span, the `.lineStart::before` rule holds the `›`, and the legend goes through `t()`.
- The opening-sequence scan now expects `<div class="sourceText" class:wrap>{#each`.

`src/lib/components/SourceText.test.ts` (new, mounted, jsdom, `invokeZero` guard; listed in
`scripts/lint/composition-guards.test.ts`, which every new mounted suite must be): for eleven texts (one
line, with and without its break, two lines, an empty line, CRLF, a lone `\r`, a BOM, a line starting
with spaces, a line starting with an invisible character, only a break, nothing) it mounts both modes and
asserts that the selectable nodes (non-empty text, `<br>`, invisible markers) are **identical**, that the
wrapping mode has one marker per file line, and that the markers hold no text; and that `a\n` and `a`
stay distinct. It proves the DOM, not what a WKWebView copy yields.

vitest rose by 20, from 4585 to 4605.

### 1.3 The review's finding, and the second shape

The first shape drew each file line as a `<div class="line">` block **without its `<br>`**, grouped by a
function `sourceLines()`, with the `›` on the block's `::before`. Codex found (`docs/reviews/4-13.md`,
SHOULD-FIX) that this made `a` and `a\n` draw the same DOM, and turned an empty line into a block holding
only generated content: a copy of the box would lose hard line breaks, which this project's premise
forbids. The fix, in the file the finding named: `sourceLines()` was removed, the segments and their
`<br>` elements are drawn exactly as the unwrapped box draws them, and the line markers became empty
inline elements (§1.1). The mounted suite (§1.2) is the regression check the review's NOT-VERIFIED line
asked for, at the level jsdom can reach.

## 2. The window half — rows classed

The full reading is `4-13-window-reading.md`. By the class of evidence:

| Row | EN | ES | Class |
|---|---|---|---|
| Variable group, chips, list, controls only when selected | L01 | L02 | a model's look |
| *Insert a choice*, name verdict, disabled *Insert* | L01; **L09** | L02 | a model's look; **owner's real input** (EN) |
| Save keeps item-owned comments; the diff holds only the change | L01; **L09** | L02 | a model's look; **owner's real input** (EN) |
| A1: `word: true` / `propagate_case: true` unquoted | L01 | L02 | a model's look |
| Form builder, shorthand shape | L03 | L04 | a model's look |
| Form builder, verbose shape; *Add a field* | L03; **L09** | L04 | a model's look; **owner's real input** (EN) |
| B1 panel and a block-scalar layout under an external change | L05; **L09** | L06 | a model's look; **owner's real input** (EN) |
| B5 measured failing | L05 | L06 | a model's look; the owner's *"Yeah, I can read it."* |
| B5 after the fix (first shape) | L10 | L11 | a model's look |
| B5 after the review fix (the shape that shipped) | L12 | — | a model's look; ES not relaunched (§4 item 7) |
| CR refusal at load | L07 | L08 | a model's look |
| CR refusal at edit and at send | — | — | **unread**: no box is drawn, so no screen reaches it |
| CRLF file's untouched bytes | L07 | L08 | a model's look, with `cmp` |
| Layout and wording | — | — | **owner judgements**: O8, O9, O10, D15 evidence (§0) |

The deliberate R38 touches, by screen and action (acceptance): **a block-scalar `layout` under conflict**
(`conflict.yml` › `:cf1`, the layout edited to three lines, then a second writer; L05, L06); **item-owned
comments** (`vars.yml` › `:greet`, a choice inserted and saved; L01, L02, L09); **a CR refusal**
(`cr.yml` › `:crlayout`, opened; L07, L08); **a CRLF file whose untouched bytes are compared**
(`crlf.yml`, a choice inserted and saved, `cmp`; L07, L08).

## 3. The instrument — uncommitted, deleted after the launches

A new, untracked `instrument-4-13/` at the repository root, rebuilt from 3-14's copy
(`/private/tmp/3-14/instrument-copy/instrument-3-14/`) without its `core-shim.ts` (no IPC call is held
here). **No tracked file was edited to host it**, it was never `git add`ed, and no hook in `src/` exists.

It was deleted with `rm -r instrument-4-13` after L11, restored byte-for-byte from the copy for one
launch on the review fix (L12), and deleted again. A verified byte copy is kept at
`/private/tmp/4-13/instrument-copy/instrument-4-13/`; the two SHA-256 lists
(`instrument-sha256.txt`, `copy-sha256.txt`) compare identical.

| Path | SHA-256 | What it is |
|---|---|---|
| `instrument-4-13/vite.config.ts` | `711fc409eb064355596a252fe1d4b6f71bc00ca36f50b65d3cee47cd99fe2943` | wraps the tracked config; injects `probe.ts` before `src/main.ts` |
| `instrument-4-13/probe.ts` | `a60e6992f8cf783705c2e626b2705e482c0166825fa650593fa9a39aa82cecc5` | the page driver and the badge |
| `instrument-4-13/probe.css` | `9c4cfba79424e3b6be0b516111714d4a6b859643ff83b75b5e881b14592c5613` | the badge's stylesheet |
| `instrument-4-13/launch.sh` | `16d83536101432cf8cf82f98db363f377fa3d7c7575736ddd425fe4b4193adb0` | one launch: scratch tree, lock checks, the second writer, captures; the `owner` route leaves the app running with no script |
| `instrument-4-13/fixtures/config/default.yml` | `7121392214ea7f2e501df6567363d0fb61a3e63f6edceaaa3582fd36fd27124a` | a synthetic profile |
| `instrument-4-13/fixtures/match/vars.yml` | `fabc23fda96af7bc0ac7e3e8b9f21978f70634bddcf3d6af76249b36d6974f30` | variables, a choice, item-owned comments |
| `instrument-4-13/fixtures/match/forms.yml` | `5ab8051c01e0eb76b584d8d123e55e9c30fa67294ac42a83c999be1d51a8b827` | a form in each storage shape |
| `instrument-4-13/fixtures/match/conflict.yml` | `068731be7e569837b458c1eb96597cacd7e36fa4ec85ca68d0a9dce5a88a99f8` | a triggers list and a block-scalar layout |
| `instrument-4-13/fixtures/match/cr.yml` | `e80562c3e558842fc98fc5c93e95bf28cd97f342bf39b7eccbadfaa7a91a75ac` | a layout holding `\r` |
| `instrument-4-13/fixtures/match/crlf.yml` | `914d9721c4d20c37625d540b8953931005b51bc43394117d0ee809cc5e6bfb41` | a CRLF file |

**Outside the repository:** the scratch trees `L01` … `L12`; the CGWindowList helper `bounds` and 3-14's
`winid`; `ls-before.txt` (before the instrument existed), `ls-before-delete.txt` and `ls-after-delete.txt`,
whose `diff` shows only the timestamp, the `instrument-4-13` entry and its ten untracked files, and
`ls-after-delete-2.txt` (after the second deletion; no `instrument` entry); the logs `build.log`,
`build2.log`, `build3.log`, `build4.log`, `check.log`, `vitest.log`, `vitest-fix.log` and
`plain-build.log`.

**Isolation:** scratch `HOME` and `XDG_CONFIG_HOME` in every launch, read back with `ps -E`. The webview's
`localStorage` follows the bundle identifier (`CLAUDE.md` §6), so the language was set through the picker
in every launch. The owner's configuration was never opened.

**Deletion evidence:** `ls -d instrument-4-13` fails; `pgrep -fl espansoconfig` finds nothing; `dist/`
was rebuilt by the plain `npm run build` (234 modules), and the probe's strings (`probe-413`,
`instrument-4-13`, `__probe`) are absent from it.

## 4. Deviations

1. **The window was 1040×1400 on the vertical display**, not the 1180×760 of every earlier reading. The
   owner asked for the vertical display, which is 1080 points wide. The viewport was 1040×1368, so every
   width in this reading is 140 px narrower than earlier readings'; the B5 measurement is, if anything,
   stricter.
2. **L09's actions were the owner's real input**, not scripted events, and L09 carries no badge readings
   of its own: its evidence is the owner's words, the captures the orchestrator took between turns, and
   the `diff`s.
3. **The orchestrator's first instruction for L09's *Add a field* left out the values step** a Choice field
   needs; the owner found the button disabled and asked. The disabled state and its sentence are the
   app's intended behaviour, recorded, not a finding.
4. **B5 was repaired on every disk-version box, not only the one measured** (§1.1): the ruling names *the*
   disk-version box, and the nine call sites draw the same box.
5. **A sentence was added** (`browser.source.wrapLegend`) to explain the wrap marker; see §1.1.
6. **The Rust gates were not run:** no Rust file changed. `dictionary_contract.rs` covers Rust variants, not
   a TypeScript-only key; the i18n parity suites cover the new key.
7. **The review fix was confirmed visibly in EN only** (L12). ES was not relaunched: the fix changed no
   string and no language-dependent rule, and L11 read the ES legend and wrap on the first shape. The
   mounted suite covers the DOM in both modes.
8. **The review fix touched one file the finding did not name**: `scripts/lint/composition-guards.test.ts`,
   which must list every new mounted suite with its guard. That listing is the fix's own consequence, not a
   separate change.

## 5. Open items (noticed, not fixed here)

Carried to later steps under `CLAUDE.md` §7; none is fixed in 4-13.

1. **O1** — the 64-hex observed-revision line overflows the conflict panel's border (reading §5).
2. **O2** — *Take out* placement differs between the variable group and the form builder. **Owner ruling:
   compact, beside the value, on both** (§0). Carried with the visual-hierarchy work.
3. **O3** — the ES form builder uses *usted* and *casilla*. **Owner ruling: tú and caja everywhere** (§0).
   A wording fix for a later step; R35 still applies.
4. **O4** — the new-variable chip reads *"new in the draft"* after a committed save, until the snippet is read
   again.
5. **O5** — the conflict comparison lists every untouched field as an empty *"left as the file has it"* row
   (17 before the relevant ones).
6. **O6** — the group's insertion openers stay enabled under an external change (no write path; their forms
   withhold *Insert*).
7. **O7** — after a save the editor stays open, and clicking another snippet highlights it in the list
   while the pane keeps the edited one, with no sentence saying why. Seen twice in L09.
8. **O8** — the detail pane's seven stacked action buttons do not stand apart from the snippet's content
   (the owner's words, §0).
9. **O9** — list labels such as *Triggers* are small grey text weighted like help sentences; the owner could
   not find one on screen.
10. **O10** — **the owner's ruling: clarity over design** (§0). It governs the visual-hierarchy work that
    O2, O8 and O9 need; a later step should take them together.
11. **D15** — **owner ruling: hide unused content kinds**; the *Content kind* buttons stay as the way to
    switch (§0). The owner's own confusion between *Form layout* and the form builder's *Layout* is the
    evidence (reading §4).
12. **Sidebar** — a long file name or the ES *Sin conciliar* badge pushes the snippet count onto its own
    line.
13. **The CR refusal at edit and at send is not readable on screen** (no box is drawn); it stays carried by
    the mounted suites alone.
14. **Carried unchanged:** every open item the earlier Phase 4 notes list, and `4-24-notes.md` §5.

## 6. Gates (the tree as left, instrument deleted)

Output went to files under `/private/tmp/4-13/`. Exit statuses were read from the tool, not through a pipe.

| Command | Exit | Result |
|---|---|---|
| `npm run check` | 0 | 520 files, 0 errors, 0 warnings |
| `npm test` | 0 | 106 files, 4605 passed |
| `npm run build` | 0 | 234 modules |
| `cargo test --workspace -- --test-threads=1` | not run | no Rust file changed |

Run after the review fix. Bundle oracle: `rg -c '\$\$payload|head_payload|push_element' dist/assets/`
found nothing, and `rg -c 'window\.__svelte|svelte-trusted-html' dist/assets/` answered 2. No probe
string was found in `dist/`.

**Rung: `1809 / 520 / 4605 / 234`.** The Rust figure is carried from 4-24 (not re-run, §4 item 6).
`svelte-check` rose by one file, the new mounted suite `SourceText.test.ts`; vitest rose by 20 (§1.2). The
module count is unchanged: no new `.ts` module or styled component is part of the bundle (the new file is
a test).
