# Phase 1c-2b-2b-2 — the whole document, and Phase 1's exit

**Status: complete.** The second half of 1c-2b-2b. The application can now show **one whole file's
text**, drawn through the same rendering primitive the detail pane uses, and Phase 1's stated exit —
*the owner can browse their entire real config and every snippet renders correctly* — has been
**checked in a running window over the real configuration** rather than assumed. §8 is the verdict.

**What this sub-phase is not.** It is not an editor and not CodeMirror; Phase 3 owns that. It adds no
Rust code at all — not one line under `src-tauri/src` or `crates/` changed — because everything it
needed was already on the wire at 1c-2b-2a. It renders no second document, no line numbers and no
selection; it displays a document faithfully and says so.

**The one-sentence claim.** `documentText()` now has a caller, and the file it answers with reaches a
screen through `sourceSegments(text, true)` and `SourceText.svelte` — so a real byte order mark, a NUL,
the other C0/C1 controls, a lone carriage return and a file with no final newline have each been
**seen** in a WKWebView, named or drawn as the primitive promises; and a file that is **not valid
UTF-8** draws a typed refusal with its byte offset rather than an empty box.

---

## 1. What was built

**`src/lib/browser/rawDocument.ts` — 130 lines, no markup.** Two decisions a test can reach:
`rawTarget(selection, documents, selected)` answers *which* file the viewer is about, and
`documentTextState(answer)` reads one `CommandResult<string>` into the four arms the pane draws —
`loading`, `text`, `empty`, `refused`. The module header carries the placement decision and its cost.

**`workspace.svelte.ts` gained the seventh command and a third generation counter.**
`BrowserCommands.documentText` is now part of the injected surface, `REAL_COMMANDS` wires it, and the
state holds `fileTextShown`, the answer, and the identity of the file the answer is about. Three
getters (`fileTextTarget`, `fileTextShown`, `fileText`) and one method (`showFileText`).

**`DetailPane.svelte` gained a mode.** A toggle at the top of the pane, drawn whenever there is a file
to show, and a branch that draws the file's text instead of the selected snippet. The document goes
through `<SourceText text={view.text} documentStart />` — the **only** place in this application
entitled to pass that flag.

**Eight new dictionary keys in both languages**, **77 new frontend tests** (19 in a new
`rawDocument.test.ts`, 16 in `workspace.test.ts`, 42 in `sourceText.test.ts`), and **no new Rust code
of any kind**. One of the eight keys — the as-written caption — was **reworded at the review**, for
the reason §4.2 gives; that and the file-text invalidation of §2.3 are the review's two blocking
fixes, and §12 is the whole disposition.

---

## 2. Decision — the viewer is a **mode of the third pane**, not a fourth pane and not the second

Four constraints decided it, written into `rawDocument.ts`'s header so the next phase meets them
before it moves anything.

1. **It must be reachable for a file that does not parse.** Such a file crosses the boundary with
   `parsed: false` and **no matches at all**, so nothing in it can ever be selected. That is exactly
   the argument `findings.ts` records for putting a file's *diagnostics* in the second pane — and it
   cuts the other way here, because it rules out keying the viewer on the selected snippet.
   `rawTarget` therefore reads the **sidebar** selection first.
2. **A whole document needs the width.** `AppShell.svelte` gives the third pane `2fr` against `1.4fr`
   and `1fr`; in the window readings the third pane is 489–506 px of content box against the second
   pane's 375. A document is drawn `white-space: pre`, so every extra pixel is a character not behind
   a scroll gesture. Measured in §6: `match/i-mixed-endings.yml` reports `scrollWidth=677`,
   `clientWidth=489` — it scrolls even there.
3. **The control belongs with the thing it controls.** The toggle is rendered in the pane whose
   content it changes.
4. **The second pane is the *set*'s pane; the third is the *thing*'s.** The snippet list answers "what
   is in this file"; the detail pane answers "show me this one closely". A file's own text is the
   second kind of question.

**The cost, stated once and not hidden.** The third pane now has **two subjects**, and a reader who
has turned the file's text on no longer sees the snippet they selected. The toggle is the only way in
and the only way out, and both of its labels name *the file's text* rather than the snippet — see
§4 for why that wording was chosen over the obvious one.

### 2.1 Which file, when the sidebar and the selection disagree

They really can disagree: a selection made in the "All" scope survives a later sidebar click. The
order is **sidebar first, selection second**, because clicking a file in the sidebar is the reader
pointing at a *file* and selecting a snippet is the reader pointing at something *inside* one. In the
"All" scope the sidebar names no file, so the selected snippet's file is the answer; with neither,
there is no target and **the toggle is not drawn at all** — read on screen (§6, plan `0`:
`--- All toggle=ABSENT`).

### 2.2 The viewer is sticky across sidebar clicks, and re-reads on every re-opening

Two behaviours that look opposed and come from one line. `readFileText()` returns early when the
target is the file it is already showing; `showFileText(false)` sets that identity to `null`. So:

- walking the sidebar with the viewer open **follows** the sidebar and reads each new file once —
  seen on screen (§6, plan `walk`);
- clicking through the snippets *of one file* does **not** re-read it — pinned;
- closing and re-opening the viewer **always** re-reads, because this application has no watcher and
  the only honest moment to take a snapshot of a file is the moment the reader asks to see it.

There was a `force` flag for the third of these until **experiment E** showed it could not change any
outcome. It is gone, and the identity comparison carries the whole policy.

### 2.3 What happens when the target goes away — the review's sixth finding

The identity comparison decides everything above, and that is exactly why **a path that removes the
target without dropping the held identity is a defect**. In the "All" scope the selected snippet's
file *is* the target, so `clearSelection()` and the `cleared` / `unresolved` arms of `applyRepair()`
can move the target to `null`; before the review they left `fileTextDocument` set, and two things
followed. Selecting a snippet in that same file again matched the held identity, returned early and
**redrew the snapshot taken before the clear** — which contradicts the policy above in the only way
that matters, by showing bytes without reading them. And an answer still **in flight** when the target
went landed with a matching generation and installed itself as that snapshot.

The fix is one helper rather than three lines at each call site, because the fragility the review
named is precisely per-call-site patching. **`forgetFileText()`** bumps the generation and nulls both
the answer and the identity, and `readFileText()` calls it whenever `fileTextTarget()` is `null`. That
makes the invalidation **total**: `clearSelection()` and `select()` (after `applyRepair`) each just
call `readFileText()`, as `show()` already did, and any future entry point that moves the target is
covered by the same call. `open()` and `showFileText(false)` use the helper too, so the four places
that drop a snapshot now drop it the same way. Experiment T is the oracle; two tests fire.

**The viewer stays sticky while nothing is targeted**, and that is unchanged on purpose. `fileTextShown`
remains `true` with no viewer and no toggle on screen, so a later sidebar click re-opens on the new
file rather than making the reader press the toggle again — §2.2's decision, and the review records it
as an observation rather than a required change. What was wrong was the **staleness**, not the
stickiness.

---

## 3. Decision — the `notUtf8` refusal is its own arm, and so is an empty file

`documentText()` returns `CommandResult<string>` (`1c-2b-2a-notes.md` §3.1). Collapsing that to a
bare string would draw a file whose bytes are not valid UTF-8 **exactly like a file of zero bytes**:
an empty box, with nothing saying which of the two the reader is looking at. That is 1c-2b-2a hole 8,
and `RawDocumentText`'s four arms are the answer — the same decision `SourceSlice` makes about a span,
one level up.

| Arm | When | What the screen says |
|---|---|---|
| `loading` | the command has not answered | *Reading this file…* |
| `text` | a non-empty string arrived | the as-written claim, then the document |
| `empty` | the command answered `""` | *This file holds no characters at all.* |
| `refused` | the command failed | *This app cannot show this file's text.* **and the typed reason** |

**The failure is carried whole rather than reduced to a sentence**, because `notUtf8` is not the only
code that lands here — `io`, `unknownDocument` and `noWorkspaceOpen` do too — and because the typed
sentence carries the **byte offset** of the first invalid sequence. On screen, in English:

> This app cannot show this file's text.
> The file /…/match/g-not-utf8.yml is not valid UTF-8 text. The first byte that is not is at offset 49.

`loading` is an arm rather than a `null` for the same reason: a pane that draws nothing while a read
is in flight says the file is empty for as long as the read takes.

**`empty` means a string of length zero and nothing else.** A file of one newline is `text`, and a
test says so, because "holds no characters at all" is false of it.

---

## 4. The strings, and the case each one sits above

Eight new keys. Every one was written by enumerating the cases it would sit above first — the
discipline `PROGRESS.md` demands after 1c-2b-1's three false claims and 1c-2b-2a's six — and **one of
the eight was still false, and was reworded at the review**. That is this sub-phase's own false claim,
found by a reviewer rather than by the enumeration; §4.2 is why the enumeration missed it.

| Key | English | The cases it sits above, and why it is true of all of them |
|---|---|---|
| `browser.detail.section.fileText` | File text | one; a heading |
| `browser.detail.fileTextShow` | Show this file's text | the viewer is closed, whatever else is on screen |
| `browser.detail.fileTextHide` | Hide this file's text | **two**: a snippet is selected and hiding reveals it, or none is and hiding reveals *Select a snippet to see it here.* **The obvious label — "Show the selected snippet" — is false in the second**, which is why both labels name the file's text instead |
| `browser.detail.fileTextScope` | This is the file itself, not the snippets read out of it. | **all four arms.** It names the *subject* of the section, not the presence of anything, so it stays true above a refusal |
| `browser.detail.fileTextAsWritten` | shown here from the file's first character to its last: characters that draw nothing are named, and every line ending is drawn as one line break | **the `text` arm only**, and its position is asserted (§7 experiment H). **Reworded at the review** — the sentence used to end "as the file writes them", which is false of line endings; §4.2 |
| `browser.detail.fileTextLoading` | Reading this file… | the `loading` arm |
| `browser.detail.fileTextEmpty` | This file holds no characters at all. | the `empty` arm — a zero-length answer, never a whitespace-only file |
| `browser.detail.fileTextUnavailable` | This app cannot show this file's text. | the `refused` arm, above **four** codes; the typed reason underneath says which |

### 4.1 Why the as-written claim is a **new** key rather than `browser.detail.valueAsWritten`

The two sentences say nearly the same thing and could have shared a key. They do not, for two reasons.
`detail.test.ts` asserts that `browser.detail.valueAsWritten` appears **exactly once** in
`DetailPane.svelte` — the 1c-2b-2b-1 review's first finding made mechanical — and a second use would
have had to weaken that assertion to "once inside the slice snippet", which is a worse guard. And the
scopes genuinely differ: one caption is over a *slice*, the other over a *whole file*, and the second
says so ("from the file's first character to its last"), which is a claim the first cannot make.

**And separating them turned out to matter for a second reason, found at the review and left open on
purpose.** `browser.detail.valueAsWritten` — *"shown here as the file writes it"*, 1c-2b-2b-1's key over
a slice — sits above the **same primitive** and therefore inherits the **same** line-ending problem
§4.2 describes: a multi-line block scalar whose endings are CRLF draws exactly like one whose endings
are LF. The review did not raise it, and this round did not change it: it is another sub-phase's string
and another sub-phase's decision record, and rewording it after this round's window reading would mean
re-taking the reading for a surface the round did not otherwise touch. **It is named here so the next
person does not have to rediscover it**, and closing it is the natural companion to closing hole 5.

### 4.2 The two transformations under the caption, and why only one of them was defensible

The caption sits above a document the primitive has changed in **two** ways, and the sub-phase's first
draft — *"…as the file writes them"* — defended both with one argument. The review's first finding is
that the argument covers one and not the other, and it is right.

**The prose markers: announced, and the argument holds.** The primitive **replaces** a character with
no glyph by prose (`1c-2b-2b-1-notes.md` §2, its stated cost), so a document holding a NUL draws
`null character U+0000` where the file holds one byte. That composite was litigated at 1c-2b-2b-1's
review and stands: the marker carries `browser.source.invisibleDetail` as its tooltip — *"The file
holds this character here. It draws nothing of its own, so this app names it rather than showing you
nothing."* — so **the transformation is announced on the same screen, by the thing that performs it**.
The alternative is a document that looks identical with and without the NUL, which is what this
application exists not to do. It remains hole 6 of `1c-2b-2b-1-notes.md`, inherited unchanged.

**The line endings: not announced anywhere, and the argument does not reach them.** `sourceText.ts`
folds a CRLF pair into a single `break` segment carrying `ending: 'crlf'`, and `SourceText.svelte`
**never reads that field** — so a CRLF and an LF draw as identical, unlabelled `<br>` elements with
nothing on screen distinguishing them. §5 measures it: `match/c-crlf.yml` renders `markers=0` and no
`0d` among the drawn code points, and `match/i-mixed-endings.yml` draws nineteen breaks of two
different kinds that all look the same. Worse for the old caption's sake, a **lone** CR *is* classified
and drawn as `carriage return U+000D`, so the same character is named in one position and silently
absorbed in another. No tooltip, no marker and no glyph carries the difference, so "announced on the
same screen" is simply not true of it.

**Which is why the string changed rather than the renderer.** Documenting the exception would have
left a false sentence on the screen, and the screen is where the claim is made. The new caption keeps
the extent claim, which is exact — first character to last, nothing trimmed and nothing capped — and
replaces the fidelity claim with the two things the renderer actually does: it **names** what draws
nothing, and it draws **every line ending as one line break**. Both halves are true of every document,
including one whose endings are mixed. Rendering the ending itself would close hole 5 of §9 and needs
a decision about what a CRLF should look like, which is a change to the primitive and not to a
sentence; the sentence is now honest about the state before that decision is taken.

`rawDocument.test.ts` holds the withdrawn phrase in both languages and asserts it gone, which is this
project's standing rule for a sentence it has taken back. Both new sentences were **read on a screen**
in both languages (§6.5).

---

## 5. The fidelity table, rendering column — **the five open rows, filled**

§5 of `1c-2b-2b-1-notes.md` left five rows marked "whole document", and the instrument for all five is
a **window reading**, not a unit test, because the question is what WKWebView does with them. All five
are now closed with evidence. The full transcript is §6; here is the table with only the rows this
sub-phase owed.

| Hazard | What rendering does | Status now | Evidence |
|---|---|---|---|
| **Leading UTF-8 BOM** | named `byte order mark U+FEFF`, and the character never enters a text node | **closed** | `match/a-bom.yml` (a copy of the corpus fixture): `markers=1 [byte order mark U+FEFF]`, and the first drawn code point is `23` — a `#`, not `feff`. Read again in Spanish as `marca de orden de bytes U+FEFF` |
| **NUL (U+0000)** | named `null character U+0000` | **closed** | `match/f-nul.yml`: `markers=1 [null character U+0000]`, `br=3`, and no `0` in the drawn code points. This is the row a slice **structurally could not** exhibit — a NUL stops the parse, so it falls outside every node span (`1c-2b-2b-1-notes.md` §5.2) |
| **Other C0/C1 controls** | named `invisible character U+XXXX` | **closed** | `match/d-controls.yml` carries U+0007, U+001B, U+007F, U+0085 and U+009F in one plain value: `markers=5`, each naming its own code point, in source order |
| **Lone carriage return** | named, and **no break drawn** | **closed, and hole 12 confirmed on screen** | `match/e-lone-cr.yml`: `markers=1 [carriage return U+000D]` and `br=3` for a file the parser reads as four lines. The viewer draws one visual line fewer than YAML sees, exactly as `1c-2b-2b-1-notes.md` hole 12 predicted |
| **No final newline** | nothing is added; the last segment is text | **closed** | `match/b-no-final-newline.yml`: `br=4`, and the drawn text ends `27` (an apostrophe). Also `single-line-no-line-ending.yml` in the unit sweep: zero breaks for a file with no line break at all |

Three further rows moved from "partly" to closed while the instrument was pointed at them:

| Hazard | Status now | Evidence |
|---|---|---|
| CRLF line endings, whole file | **closed for a document, in the exact sense that no `0d` reaches the DOM** — a CRLF draws one break and is not distinguishable from an LF, which is now what the caption says | `match/c-crlf.yml`: `br=13`, `markers=0`, and **no `0d` anywhere** in the drawn code points |
| Mixed line endings in one file | **still hole 3, and now seen** | `match/i-mixed-endings.yml`: `br=19`, `markers=0`, no `0d`. Both endings draw one break each and **which** ending each was is still not rendered. The data is on the segment; nothing shows it. This is the measurement the review's first finding rests on, and §4.2 is what the caption now says instead |
| Not valid UTF-8 at all | **closed — the refusal has a screen** | `match/g-not-utf8.yml`, §3's transcript, in both languages |

**The lone CR row and the CRLF row are the same character treated two ways**, and it is worth saying so
in one place: a `\r` that is part of a `\r\n` pair is folded into the break and vanishes, and a `\r`
that stands alone is classified `carriageReturn` and drawn as a named marker with no break at all. Both
are deliberate and both are measured above; the caption above the document no longer implies otherwise.

**One row is not closed and is not claimed to be.** A **lone surrogate** cannot arise on this wire
(`1c-2b-2a-notes.md` §4) and therefore cannot be rendered; nothing here changes that, and testing it
would require changing the wire representation.

---

## 6. The window readings

Taken by the technique of `1c-1-notes.md` §10, with one change forced by the instrument and recorded
in §6.1. **`cargo build -p espansoconfig --features custom-protocol` followed `npm run build` before
every launch**, per the rule 1c-2b-1 added.

**The configuration read for readings A, B and C was synthetic and hand-written for this run**, in a
scratch directory outside the repository: nine `match/*.yml` and one `config/default.yml`, three of
them byte-for-byte copies of committed corpus fixtures (`bom-utf8.yml`, `no-trailing-newline.yml`,
`crlf-line-endings.yml`, `file-comments-and-mixed-endings.yml`) and the rest neutral three-line files
carrying one hazard each. `XDG_CONFIG_HOME` and `HOME` both pointed into the scratch tree.

**Reading D is over the owner's real configuration**, and is governed by D1: the probe plan used for
it (`census`) reports **file names, counts, DOM shapes and this application's own strings, and never
one character of the file's own text** — no `innerText` of a source box, no code-point dump, no
snippet label. Nothing below quotes real configuration content.

### 6.1 What the instrument cost, written down because it will cost the next phase too

**A WKWebView whose window is not frontmost stops running `setTimeout` a few seconds after launch.**
1c-2b-2b-1 recorded this as "throttling"; it is stronger than that. A probe that walked eleven files
in one run stalled dead at 6 s, three times, at a different file each time; `open -a` did not restart
it and `-NSAppSleepDisabled YES` did not prevent it. The fix is structural: **one plan per launch**.
A temporary `probe_plan()` command reads `ECFG_PROBE_PLAN` from the environment and the driver does
one thing with it, so every run finishes in under three seconds. A shell script relaunches the app
once per plan into its own bundle path — LaunchServices reports a previously-used bundle path as
"already running" and silently drops the `--env` arguments, which is its own trap.

Both probe files (`src/main.ts`, `src-tauri/src/main.rs`) were restored from copies taken before the
probe existed and compared with `diff`: **identical**, and `git status` shows neither modified.

### 6.2 Reading A — the five open rows, English

Per-file, from the transcript. `ws` is the computed `white-space`; `points` is the drawn text's code
points and only the significant part of each is quoted.

```
--- All                       toggle=ABSENT
--- match/a-bom.yml           br=7  markers=1 [byte order mark U+FEFF]      ws=pre scrollW=590 clientW=489
                              points=23 20 55 54 46 2d 38 …            (first drawn code point is '#')
--- match/b-no-final-newline  br=4  markers=0                              ws=pre scrollW=564 clientW=489
                              points=… 74 6f 72 27                     (ends at an apostrophe)
--- match/c-crlf.yml          br=13 markers=0                              ws=pre scrollW=608 clientW=489
                              points=…                                  (no 0d anywhere)
--- match/d-controls.yml      br=3  markers=5 [U+0007 | U+001B | U+007F | U+0085 | U+009F]
--- match/e-lone-cr.yml       br=3  markers=1 [carriage return U+000D]
--- match/f-nul.yml           br=3  markers=1 [null character U+0000]
--- match/g-not-utf8.yml      no source box at all; the refusal block, with offset 49
--- match/h-empty.yml         no source box at all; "This file holds no characters at all."
--- match/i-mixed-endings.yml br=19 markers=0                              ws=pre scrollW=677 clientW=489
--- config/default.yml        br=1  markers=0
```

and the whole pane for the BOM file, `innerText`, elided only where it repeats:

> Hide this file's text / File / match/a-bom.yml / FILE TEXT / This is the file itself, not the
> snippets read out of it. / shown here from the file's first character to its last, as the file
> writes them / **byte order mark U+FEFF**`# UTF-8 BOM fixture …` *(seven more lines)*

**That transcript quotes the caption as it read at the time**, and it has since been reworded (§4.2).
Readings A to D are left exactly as they were taken — a reading is a record of a screen at a moment,
and editing one to match a later string would be inventing evidence. §6.5 is the reading of the new
sentence.

The sidebar in the same run, which is where the unreadable file is accounted for:

> All / 11 / Some files could not be read, so this total counts only the files that were. / The file
> …/match/g-not-utf8.yml is not valid UTF-8 text. The first byte that is not is at offset 49. / FILES
> / match/a-bom.yml 2 / match/b-no-final-newline.yml 1 / match/c-crlf.yml 3 / match/d-controls.yml 1
> / match/e-lone-cr.yml 0 / match/f-nul.yml 1 / match/g-not-utf8.yml **Could not be read** /
> match/h-empty.yml 0 / match/i-mixed-endings.yml 3 / PROFILES / config/default.yml –

**Two things in that sidebar are worth naming rather than passing over.** `match/e-lone-cr.yml` shows
`0` because the lone CR made *that* document fail to parse — the substrate accepts a lone CR when the
following line is properly indented and this file's is not — and `match/h-empty.yml` shows `0` because
it is genuinely empty. **The two are indistinguishable on that row**, which is 1c-2b-1 hole 2, seen
rather than reasoned about, and still open (§9).

### 6.3 Reading B — the same arms in Spanish

The language was switched through the application's own picker with a **bubbling** `change` event
(Svelte 5 delegates that event; a non-bubbling one silently does nothing).

> Ocultar el texto de este archivo / Archivo / match/a-bom.yml / TEXTO DEL ARCHIVO / Esto es el
> archivo en sí, no los fragmentos que se leen de él. / se muestra aquí desde el primer carácter del
> archivo hasta el último, tal y como los escribe el archivo / **marca de orden de bytes U+FEFF**…

and, for the two arms that draw no document:

> Esta aplicación no puede mostrar el texto de este archivo. / El archivo …/match/g-not-utf8.yml no es
> texto UTF-8 válido. El primer byte que no lo es está en la posición 49.

> Este archivo no contiene ningún carácter.

with `carácter nulo U+0000` for the NUL and `retorno de carro U+000D` for the lone CR. **The file's own
text stayed English throughout**, which is correct — it is the file's text, not the interface's.

### 6.4 Reading C — re-taken after the last source change

Experiment E removed the `force` flag from `readFileText`, which is a change to the module the viewer's
behaviour comes from, and the standing rule is that a claim about a screen is re-taken after any such
change. Reading C repeats the five rows and adds the **walk**: open the viewer on one file, then click
three sidebar rows without touching the toggle again.

```
walked to row 2: fileShown=match/b-no-final-newline.yml  box=present refused=false br=4   toggle="Ocultar…"
walked to row 3: fileShown=match/c-crlf.yml              box=present refused=false br=13  toggle="Ocultar…"
walked to row 4: fileShown=match/d-controls.yml          box=present refused=false br=3   toggle="Ocultar…"
```

The file name in the pane and the break count under it agree, file by file, with reading A's per-file
numbers — which is the property the sticky viewer has to have and the one an unguarded implementation
would break by leaving the previous file's text under the new name. All five hazard rows re-read
identically (`br=7 markers=1 [marca de orden de bytes U+FEFF]`, `br=3 markers=1 [carácter nulo
U+0000]`, `br=3 markers=1 [retorno de carro U+000D]`, `br=3 markers=5 […]`, the refusal, the empty
file). This run happened to be in Spanish: the locale override set in reading B persists in the
webview's storage, which is keyed by `HOME`.

### 6.5 Reading E — the reworded caption, taken at the review

**Required because the review changed a user-facing string**, and the standing rule is that a claim
about a screen is re-taken after any change to a component or a string it draws. One plan, one launch,
the technique of §6.1 unchanged: `npm run build`, then
`cargo build -p espansoconfig --features custom-protocol`, into a **fresh** bundle path with its own
`HOME` and `XDG_CONFIG_HOME`.

**The configuration was synthetic and hand-written for this run** — one `match/probe.yml` of six
neutral lines and one `config/default.yml` — with two properties chosen so the new sentence has
something to be about: one **soft hyphen** inside a `replace:` value, and **two CRLF line endings among
four LF ones**. The plan selects the file, opens the viewer, sets the language to English through the
application's own picker, reads, sets it to Spanish and reads again.

```
buttons=5 row=found
toggle=Show this file’s text
EN caption=shown here from the file’s first character to its last: characters that draw nothing are
          named, and every line ending is drawn as one line break
EN box=present br=6 markers=1   named=[soft hyphen U+00AD]
ES caption=se muestra aquí desde el primer carácter del archivo hasta el último: los caracteres que no
          dibujan nada se nombran y cada final de línea se dibuja como un solo salto de línea
ES box=present br=6 markers=1   named=[guion discrecional U+00AD]
```

**Both halves of the new sentence are visible in the same reading it captions.** `markers=1` with
`soft hyphen U+00AD` is the naming clause; `br=6` for a file with six line endings **of two different
kinds** is the line-break clause, and the fact that the transcript cannot say which two were CRLF is
exactly the honesty the rewording buys. Both languages, one launch, and the file's own text stayed as
the file wrote it while the interface changed language around it.

Both probe files (`src/main.ts`, `src-tauri/src/main.rs`) were restored from copies taken before the
probe existed and compared with `diff`: **identical**. `dist/` was rebuilt from the reverted source and
came back to the same asset hash it had before the probe, and the scratch tree was deleted.

### 6.6 What the readings are evidence of, and what they are not

**Evidence of:** what WebKit laid out and what the DOM held — read as text, as code points, as element
counts and as computed `white-space`. This is the second body of WKWebView-level evidence in the
project, after 1c-2b-2b-1's, and it is the first over a **whole document**.

**Not evidence of:** pixels. It cannot see a marker painted the same colour as its background, a box
clipped by a parent, or a scrollbar that does not appear. That remains `1c-1-notes.md` hole 6.

---

## 7. The disabling experiments

**Twenty**, each performed by breaking the **implementation** and observing which tests fired, each
reverted before the next, with the suite green in between. Every touched file was compared with a
byte-identical copy at the end (§10). **Three did not fire, and two of those changed the code.**

**Thirteen of the twenty were re-run at the review** — A, B, C, D, F, G, H, M, N, P, Q, R and S: every
one whose break lands in a file this round edited (`workspace.svelte.ts`, `rawDocument.ts`,
`DetailPane.svelte`) or whose oracle is a test this round renamed or strengthened. Two counts moved
and are corrected below, both because a **test body** was strengthened, not because behaviour changed.
**T is new**, and it is the oracle for §2.3's fix. Row E cannot be re-run — the `force` flag it broke
no longer exists, which is exactly what the experiment established, and F is its standing replacement.

| # | The break | What fired |
|---|---|---|
| A | `documentTextState` answers `empty` for a failure | **5** (was 3, before two bodies were strengthened at the review): `tells a file of no characters apart from one it could not read` (both files), `carries each of the four refusals whole…`, `holds a file it cannot decode in the refused arm, never in the empty one`, `reports a refusal to the developer as well as holding it on the state` |
| B | `rawTarget` drops the sidebar branch and reads the selection only | **12**, including `takes the sidebar's file when nothing at all is selected` — the half of the reachability property a pure function over summaries can carry |
| **C** | the identity guard removed from the `fileText` getter | **nothing.** See below |
| D | `readFileText` reuses the current generation instead of taking one | **1**: `discards an answer whose file the reader has already moved off` |
| **E** | `showFileText(true)` passes `force: false` | **nothing.** See below |
| F | `showFileText(false)` keeps the held file identity | **1**: `re-reads on every re-opening, because the file may have changed` |
| G | `<SourceText>` loses `documentStart` | **1**: `passes documentStart to the shared primitive, and writes no second renderer` |
| H | the as-written caption moved above the `{#if}` | **1**: `writes the as-written caption inside the text arm's branch and nowhere else` |
| I | the classifier stops treating a U+FEFF at byte 0 as a BOM | **2**: `is named as one when the text starts a document`, `names the byte order mark of the fixture that has one` |
| J | `sourceSegments` normalises its input with NFC | **4**, including `rebuilds unicode-offsets.yml character for character` — the new corpus sweep catching a normaliser on a **real committed file** |
| K | the corpus path in the test points one directory up | **6**, the first being `has fixtures to read at all, so the sweep below cannot be vacuous` |
| L | `browser.detail.fileTextUnavailable` deleted from `es.json` | **`npm run check`**: 4 errors, the first naming the missing key at `dictionaries.ts` |
| **M** | the toggle keyed on `browser.selectedMatch` instead of `browser.fileTextTarget` | **nothing, the first time.** See below. Re-run at the review: **1**, `keys the toggle's markup on the target rather than on the selection` |
| N | the refusal arm loses `tIpcFailure(view.failure)` | **1**: `writes the refusal, the empty file and the typed reason as three separate strings` |
| O | `documentTextState` treats a whitespace-only file as empty | **1**: `treats a whitespace-only file as text, not as an empty one` |
| P | `open()` no longer closes the viewer | **1**: `closes with the workspace, because every identity is about to be reused` |
| Q | `show()` no longer re-reads | **3** (was 2, before a body was strengthened at the review): `tells a file of no characters apart from one it could not read`, `reads the new file when a sidebar click moves the target`, `discards an answer…` |
| R | `readFileText`'s identity comparison always false | **1**: `does not re-read one file because the reader clicked another snippet in it` |
| S | a refused read no longer reaches `report` | **1**: `reports a refusal to the developer as well as holding it on the state` |
| **T** | `readFileText` returns instead of calling `forgetFileText()` when the target is `null` — the state before §2.3's fix | **2**: `re-reads a file whose target was cleared, rather than redrawing the old snapshot`, `drops an answer in flight when the target is cleared, so no later selection reuses it` |

### 7.1 The three that did not fire, and what was done about each

**C — the identity guard in the `fileText` getter is unreachable, and now says so.** Removing
`target.id === fileTextDocument ? fileTextAnswer : null` fails nothing, because every path that moves
the target calls `readFileText`, which sets the new identity and nulls the answer **synchronously**
before any getter can run. The guard is **kept** — the failure it forecloses is the worst this pane
could have, one file's bytes drawn under another file's name, and the invariant it depends on lives in
a different function — but the comment above it now states that no call site can trigger it and names
this experiment. **A test comment that claimed the guard was what made a `loading` assertion pass was
false and has been corrected**; that is this sub-phase's instance of the pattern `PROGRESS.md` warns
about, caught by running the experiment rather than by writing the sentence more carefully.

**E — the `force` flag could not change any outcome, so it is gone.** `showFileText(false)` clears the
held identity, so `readFileText` re-reads on the next opening whether or not it is forced. The
parameter was removed at all three call sites, `readFileText`'s doc comment records why, and
experiment F is the replacement: it puts the *identity clearing* back and the test fires.

**M — the markup scan was too weak, and was strengthened until it fired.** `fileTextTarget` appears
twice in `DetailPane.svelte`, so `toContain('browser.fileTextTarget !== null')` passed with the toggle
keyed on `selectedMatch` — the exact defect that would make a file which does not parse unreachable.
The assertion is now on the **condition and the block it guards together**, and re-running M fails it
by name. This is R31's lesson in its sharpest form: a presence check over a file that mentions a
symbol twice is not a check on either mention.

---

## 8. Phase 1's exit, checked

Plan §12's Phase 1 exit: *"the owner can browse their entire real config and every snippet renders
correctly."* Nothing in this project had run the UI over the real corpus before this sub-phase. It has
now, in a running window, and **the exit is met**. The evidence, in counts, file names and DOM shapes
only:

**Every file is listed, projected and readable.** 13 files (12 under `match/`, 1 under `config/`),
14 sidebar rows including "All". **Zero load failures**, so no partial-total block; **zero findings**
— no diagnostic and no hazard on any of the thirteen; every file `parsed`.

**Every file's whole text renders.** All 13 rows reach the `text` arm of the viewer — none refused,
none empty, `white-space` computed to `pre` on every one, and `markers=0` everywhere, which is itself
a fact worth recording: the owner's configuration contains **no character the classifier names**.

| File | snippets | breaks drawn | DOM nodes in the source box |
|---|---|---|---|
| `match/ai.yml` | 10 | 109 | 764 |
| `match/base.yml` | 3 | 39 | 247 |
| `match/colegio-correos.yml` | 4 | 110 | 762 |
| `match/colegio-varios.yml` | 2 | 40 | 281 |
| `match/gam.yml` | 2 | 27 | 190 |
| `match/google-sheets.yml` | 2 | 15 | 106 |
| `match/jamf.yml` | 1 | 21 | 148 |
| `match/javascript.yml` | 7 | 199 | 1 394 |
| `match/simbolos.yml` | 2 | 15 | 106 |
| `match/sql.yml` | 14 | 631 | 4 409 |
| `match/terminal.yml` | 9 | 65 | 456 |
| `match/varios.yml` | 9 | 94 | 659 |
| `config/default.yml` | – | 62 | 381 |

**Every snippet renders.** All **65** were clicked in turn in the "All" scope, one launch per batch of
ten. Every one produced a detail pane with **3 to 6 sections**, between **566 and 1 991 characters** of
text, and **exactly one source-text box**; none produced an empty pane, a missing source section or a
thrown error. The per-file counts above sum to 65 and the middle pane's summary read `65 of 65`.

**What this verdict does not cover, said rather than implied.**

- **The real corpus produces zero unmodelled entries** (13 files, 566 keys, all modelled), so this run
  exercises the unmodelled-value surface **not at all**. Synthetic fixtures are that surface's only
  coverage, permanently, and this measurement is why.
- It produces zero diagnostics and zero hazards, so the middle pane's findings surface is likewise
  untouched by it.
- "Renders correctly" is established here as *renders, with the expected structure, without failing*.
  It is not a claim that every field is **right**, which would need a reader comparing the pane against
  the file — and D1 forbids recording what such a reader saw.
- The reading is DOM-level, not pixels (§6.6).

### 8.1 What a large document costs, measured — hole 9 closed

`1c-2b-2b-1-notes.md` hole 9 said nothing measured what a whole document costs the primitive. Three
measurements now do.

**In the primitive, as a cost model** (`sourceText.test.ts`): a document of *n* ordinary lines produces
exactly `2n` segments — one text run and one break each — and a document of nothing but named
characters produces exactly `2n`. Both are linear and both are asserted, over 2 000 and 8 000 line
documents; the largest is **968 000 bytes**, more than fifty times the largest file this application
has ever been pointed at.

**In the window, as wall-clock and DOM size**: `match/sql.yml` — the largest real file, **631 lines and
17 840 bytes** — goes from the toggle click to a laid-out box in **45 ms and 56 ms** on two runs, with
**4 409 DOM nodes** in it. `match/javascript.yml` (199 breaks, 6 785 characters) takes **40 ms** and
1 394 nodes. Both numbers include the IPC round trip for `document_text`.

**The decision that follows: nothing is capped.** `1c-2b-2a` left `value_text` uncapped and named the
cost; the raw viewer is the first surface to hold a whole document and its slices in one frame, and it
is uncapped too. A cap would have to either truncate — which this application must not do silently —
or refuse, which needs a screen and a sentence for a case nothing has met. **What is not measured is a
document far larger than any espanso configuration in a *window*:** the primitive handles a megabyte in
a unit test, and no WKWebView has been asked to lay one out. That is hole 6 below, and it is a smaller
hole than the one it replaces.

---

## 9. Coverage holes, stated as holes

1. **Nothing renders a Svelte component in an automated test** — `1c-1-notes.md` hole 1, unchanged, and
   now load-bearing on a second surface. The four arms of `RawDocumentText` are covered as *data*; that
   they are *drawn* is §6 and nothing else, and it must be re-taken after any change to `DetailPane`.
2. **The pane still renders file text two different ways** — 1c-2b-2b-1 hole 5, deliberately left open
   again. The source, value and now whole-document surfaces go through the primitive; the **scalar
   rows do not**, and still print `ScalarView.text` into a `pre-wrap` `<pre>`. So a U+2028 inside a
   `replace:` value is named twice on the screen — in the source-text section and in the file's text —
   and drawn as nothing in the replacement row. **The reason for leaving it is not scope alone.**
   `SourceText` renders a bordered, padded, horizontally scrolling **block**; every scalar row is an
   inline value in a baseline-aligned flex row beside its markers. Routing the rows through it as it
   stands would turn every one-line trigger into a bordered box, which is a redesign of the pane rather
   than a fidelity fix, and it needs the primitive to grow an inline presentation first. Recorded as a
   decision, not an oversight.
3. **A file that failed to parse still shows `0` exactly like an empty one** — 1c-2b-1 hole 2, and §6.2
   is the first time it has been **seen**: `match/e-lone-cr.yml` (parse failed) and `match/h-empty.yml`
   (genuinely empty) show the same `0` on adjacent rows. `parsed` is on the wire. Not closed here
   because the fix is a sidebar-row presentation change with its own strings, and this sub-phase's
   subject is the document.
4. **The empty snippet list and the sentence explaining it still come from unrelated code** —
   1c-2b-1 hole 16, untouched.
5. **Mixed line endings are still invisible** — 1c-2b-2b-1 hole 3. Each break draws as one break and
   the segment's `lf`/`crlf` renders nowhere. Now seen on a whole document (`i-mixed-endings.yml`,
   `br=19`, two of them CRLF), which makes it a hole with a measurement rather than a hole with an
   argument. `DocumentView.line_ending` is also on the wire and also unused. **What changed at the
   review is the sentence above the document, not the renderer**: the caption used to imply the
   endings reached the screen and now says plainly that every one of them draws as one line break
   (§4.2). The hole is unchanged in extent and is no longer contradicted by a caption.
6. **No window has laid out a document far larger than an espanso configuration.** §8.1 measures the
   primitive to 968 000 bytes in a unit test and WKWebView to 17 840 bytes in a window. The gap between
   the two is not covered by anything.
7. **The viewer shows one document at a time and has no line numbers, no search and no selection
   affordance.** Deliberate — Phase 3 owns CodeMirror — but worth naming, because "the raw YAML viewer"
   is a phrase that could be read as more than this is.
8. **A second YAML document in one file still has no screen.** `additionalDocumentNotProjected` is a
   diagnostic; the raw viewer shows the whole *file*, so its bytes are now visible, but nothing says
   which part of what is on screen espanso ignores.
9. **Nothing establishes that the Spanish strings are Spanish.** The untranslated-value check
   establishes non-identity. Eight new strings were written in Spanish and read on a screen by their
   author (§6.3); a bilingual reviewer remains the only instrument that closes this.
10. **The window reading is not pixels** — `1c-1-notes.md` hole 6, unchanged and restated in §6.6.
11. **`SourceSlice`'s `unavailable` arm has still never been on a screen** — 1c-2b-2b-1 hole 8,
    untouched. Note what *did* close: its sibling at the document level, the `notUtf8` refusal, which
    is 1c-2b-2a hole 8 and is now read in both languages. The two were often written about together and
    they are different: one is reachable only through a defect, the other through a file.
12. **Nothing measures how the viewer behaves while a file changes on disk under it.** There is no
    watcher, the text is re-read on every opening, and that is the whole policy. A file edited while
    the viewer is open shows stale bytes until the reader closes and re-opens it, with nothing saying
    so.
13. **The real-corpus verdict rests on a probe whose own reporting is deliberately blind.** §8's
    numbers come from a plan that reports counts and DOM shapes and never text, because D1 forbids the
    alternative. So "every snippet renders correctly" is established at the structural level described
    in §8 and not at the level of "this field shows what the file says", which no recordable instrument
    in this repository can reach.
14. **Phase 2 has no way to refresh the file this viewer is showing, and `RawDocumentText.text` is not
    authority for a write.** The review's eighth finding, recorded here rather than fixed, because the
    fix belongs to the phase that first needs it. Two halves, both real:
    - **No post-write refresh exists.** `readFileText()` returns early when the target is the file it
      already holds, and the `force` flag that could have overridden that was deleted at experiment E
      because nothing in a read-only application could reach it. So after a successful write, the
      viewer keeps showing the bytes it read *before* the write, and **closing and re-opening it is the
      only way to see the new ones**. Phase 2 must add an explicit invalidation — `forgetFileText()`
      (§2.3) is now the obvious place, and calling it after a successful write makes the next read
      real — and it must add it deliberately, because nothing fails without it.
    - **The text carries no revision.** `RawDocumentText.text` is a `string` and nothing else; the
      `ContentRevision` that says which bytes it came from is not on it. A write that used this text
      as its base — a whole-file replacement, say — would be writing over whatever is on disk *now*
      with what was read at some earlier moment, which is precisely the class of loss this project
      exists to prevent. **The viewer's text is for reading. It is not a base for an edit**, and any
      surface that wants one has to carry a revision with it.

---

## 10. Verification

| Command | Result |
|---|---|
| `npm run check` | **0 errors, 0 warnings**, 374 files |
| `npm test` | **662 passed**, 27 files. **+77**: 19 in a new `rawDocument.test.ts`, 16 in `workspace.test.ts`, 42 in `sourceText.test.ts` — three of them added at the review (§12). The suite stood at **585** when this sub-phase started, measured by subtraction; `1c-2b-2b-1-notes.md` records 583 at its own close, and the two-test difference predates this change and is not accounted for here |
| `npm run build` | ok, `dist/assets/index-CgRncva7.js` 113.30 kB |
| `cargo build --workspace` | ok |
| `cargo test --workspace` | **561 passed, 0 failed**, unchanged — this sub-phase adds no Rust |
| `cargo clippy --workspace --all-targets -- -D warnings` | clean |
| `cargo fmt --check` | clean |
| `cargo tree -p espansoconfig-core \| rg tauri` | **no output** — the architecture rule holds (D2x) |
| `git status --short --untracked-files=all` | eight modified, four new; **no real-config path** |

**Counts.** 248 dictionary keys in each language (240 before): **8 new**, listed in §4, and **one of
those eight reworded at the review** — `browser.detail.fileTextAsWritten`, §4.2. No key that existed
before this sub-phase was touched. No new key is identical between the two languages, so
`IDENTICAL_BY_DESIGN` in `dictionaries.test.ts` is untouched. Placeholder parity holds by that file's
own check, and neither new sentence carries a placeholder.

**The probe was reverted and the tree verified — twice, once per round.** `src/main.ts` and
`src-tauri/src/main.rs` were restored from copies taken before each probe was added and compared with
`diff` — identical both times, and `git status` lists neither. Every file a disabling experiment
touched, in both rounds, was restored from a pristine copy and `diff`ed. `dist/` was rebuilt from the
reverted source before each verification run, and after the review's reading it came back to the same
asset hash it had before that probe existed. The scratch copy of the real configuration and the
review round's synthetic scratch tree were both deleted.

### 10.1 R31 — the blind spots, by name

`scripts/lint/hardcoded-strings.ts` reads `.svelte` **markup** only. A clean run means "no literal is
sitting in markup", and here is what it did not look at in this change:

1. **`<script>` blocks**, whole — including `DetailPane.svelte`'s, which is where the new
   `RawDocumentText` import and the props live.
2. **`.ts` files** — `rawDocument.ts`, `workspace.svelte.ts`, and the three test files. The scanner
   reads none of them. The new prose in them is JSDoc and comments.
3. **Component doc comments**, masked with the block they sit in — and this change added about forty
   lines to `DetailPane.svelte`'s.
4. **Text reaching the screen through a prop**: `SourceText`'s `text` prop, which is the file's own
   text rather than an interface string.
5. **`.svelte` `<style>` blocks**: the two new rules (`.toggle`, `.refused`) contain no `content:`
   declaration, so no string reaches a screen through CSS. Checked by reading them, not by the linter.
6. **Both probes** — this sub-phase's and the review round's — which were markup-free, lived in
   `src/main.ts` and are reverted.
7. **`scripts/lint/built-translation-keys.ts` does cover the new markup** — it scans every `.svelte`
   file under `src/` and refuses any `t(` whose key is not written literally. All eight new calls are
   literal keys.

**What is inside the scanner's field of view, and passed**: the toggle's two labels, the section
heading, the scope sentence, the as-written claim, and the three arm sentences are all `t('literal')`
calls in markup with no literal prose beside them.

### 10.2 The claim-versus-data sweep

Every sentence here that asserts something about data was checked against the data first. Three things
came out of it:

- **the `force` flag and the identity guard** (§7.1). Two pieces of code carried an implied claim about
  what they prevented; running the experiments showed one could not change an outcome and the other
  could not be reached. One was deleted and the other kept with its status written on it. **A test
  comment that had already asserted the guard's role was false and was corrected** — the fourth
  occurrence in this project of a sentence written from intent rather than from data, and the first
  caught by an experiment rather than by a reviewer;
- **the markup scan** (§7.1, experiment M). The assertion said "draws the toggle from the target rather
  than from the selection" and could not have failed if the claim were false. Strengthened until it
  could;
- **the scale sentence in `sourceText.test.ts`.** A comment said the largest real file was "smaller by
  an order of magnitude" than the test's synthetic document. Measuring it gave 631 lines / 17 840 bytes
  against 968 000, which is more than fifty times, and the comment now carries the numbers.

**The sweep did not catch everything, and the review found what it missed** — which is the honest
summary of findings 1 to 5. All five are the same defect wearing two hats: **a sentence claiming more
than the thing under it establishes.** One was a sentence on a *screen* (the as-written caption, §4.2)
and four were sentences in *test names*; §12 lists each and what was done. The pattern that produced
them is worth naming once: every one of them was written from what the code was **for** rather than
from what its body **does**, and the check that catches it is R24's corollary — read the name, then the
body, and ask whether the body could fail if the name's claim were false. Applied to a caption, the
same question reads: could the screen look like this if the sentence were false? For "as the file
writes them" over a CRLF document, it could, and did.

---

## 11. What the next phase inherits, and should not rebuild

- **`rawDocument.ts`, and the placement argument in its header.** Moving the viewer means answering all
  four constraints again, and constraint 1 — a file that does not parse must stay reachable — is the
  one that is easy to break by accident.
- **`RawDocumentText`'s four arms.** A refusal, an empty file and a read in flight are three different
  facts and each has its own sentence. Any future raw surface inherits the rule: **a file this
  application cannot show must not look like an empty one.**
- **`documentStart` has exactly one caller and must keep exactly one.** It is the only way a `bom`
  segment is produced, and a slice that passed it would claim to know where byte 0 is.
- **The corpus sweep in `sourceText.test.ts`.** Every committed fixture now goes through the primitive
  and is rebuilt character for character. It is the cheapest place to catch a normaliser, a line-ending
  rewrite or a lost character, and experiment J shows it firing on a real committed file.
- **The cost model, asserted rather than assumed** (§8.1): `2n` segments for *n* lines, measured to
  968 000 bytes in a test and to 17 840 bytes in a window. Nothing is capped, and the reason is
  written down.
- **One plan per launch** (§6.1). The window-reading technique of `1c-1-notes.md` §10 does not survive a
  probe longer than about six seconds; the fix is in this document and the next phase should start from
  it rather than rediscover it.
- **Phase 1's exit is discharged** (§8) — with three named things it does not cover, of which the
  sharpest is that **the real configuration exercises the unmodelled-value surface not at all**.
- **Fourteen holes** (§9). Three of them — the two rendering paths for file text, the parse-failed `0`,
  and the invisible mixed endings — are now holes with **measurements** rather than holes with
  arguments, and each names the change that would close it.
- **Hole 14 is addressed to Phase 2 by name** and is the one thing in this list a phase can fail by
  ignoring: **there is no way to refresh the displayed file after a write**, and
  **`RawDocumentText.text` carries no revision and is not authority for one**. The first needs an
  explicit invalidation after a successful write — `forgetFileText()` in `workspace.svelte.ts` is the
  place — and the second is a rule: read the file's text to *show* it, never to *base an edit on it*.

---

## 12. The review disposition

`docs/reviews/phase-1c-2b-2b-2-whole-document.md`, eight findings — **two blocking, five follow-up and
one confirmation**. **Seven are closed**; the eighth is recorded rather than fixed, with an owner, and
that is stated as a decision below rather than left to be discovered.

| Finding | Kind | Disposition |
|---|---|---|
| 1 | **Blocking** | **Fixed by rewording the string in both languages**, which is what the review asked for and the only fix that leaves the *screen* honest — documenting the exception would have left a false sentence on it. `browser.detail.fileTextAsWritten` no longer says "as the file writes them"; it keeps the extent claim, says invisible characters are **named**, and says every line ending draws as **one line break**. §4.2 records the reasoning in full, including the half of the old defence that **does** hold (the prose markers, announced by their own tooltip) and the half that never covered line endings at all. §4's table row and §5's two line-ending rows now agree with it, hole 5 says what changed and what did not, and `no longer claims the file's own line endings reach the screen` in `rawDocument.test.ts` holds both withdrawn phrases and asserts them gone. Read on a screen in both languages: §6.5. |
| 2 | Follow-up | **Both renamed; one body also strengthened.** `takes a file the sidebar names even when it holds no snippets` → `takes the sidebar's file when nothing at all is selected`, because `rawTarget` is given summaries and can never be given a match list: what the body supplies is a `null` selection, and that is now what the name says. `carries the failure whole, so four refusals do not share one sentence` → `carries each of the four refusals whole rather than reducing them`, and the body now supplies **all four** codes rather than one; the "sentence" half of the claim is gone, because nothing in the body reads a sentence. Experiment A's count moved from 3 to 5 as a result. |
| 3 | Follow-up | **Both renamed to what a string comparison establishes.** `says two different things about a file it cannot show and one that is empty` → `gives the refusal and the empty file different sentences in both languages` (it proves inequality). `labels the toggle by what it will do, not by what is selected` → `writes both toggle labels with no operand to interpolate` (it proves the absence of a placeholder). Each keeps its comment, which is where the *reason* the strings are written that way belongs; the reason is §4's argument, not the assertion's. |
| 4 | Follow-up | **All four renamed off the word "draws".** Nothing in this project renders a Svelte component in a test (hole 1), so no test may promise rendering: `passes documentStart to the shared primitive, and writes no second renderer`, `writes the as-written caption inside the text arm's branch and nowhere else`, `writes the refusal, the empty file and the typed reason as three separate strings`, `keys the toggle's markup on the target rather than on the selection`. The suite's own header already said it was a text scan; the names now say it too. Experiments G, H, M and N re-run and fire by the new names. |
| 5 | Follow-up | **Two renamed, one strengthened — and the third one strengthened rather than renamed, because the input was cheap.** `says a file it cannot decode is refused` → `holds a file it cannot decode in the refused arm, never in the empty one`; `reports a refusal to the developer as well as to the screen` → `…as well as holding it on the state`, with the state assertion added so both halves of the name are checked. `tells a file of no characters apart from one it could not read` now supplies **both** inputs — an empty file and an unreadable one — so it can no longer pass if unreadable files were classified as empty. Experiments A and Q each fire one test more as a result, and both counts are corrected in §7. |
| 6 | **Blocking** | **Fixed with one helper, not three patched call sites.** `forgetFileText()` bumps the generation and nulls the answer and the identity; `readFileText()` calls it whenever the target is `null`, which makes the invalidation **total** rather than a list of remembered places. `clearSelection()` and `select()` (after `applyRepair`) now call `readFileText()`, as `show()` already did; `open()` and `showFileText(false)` use the helper. §2.3 is the record. Two new tests — `re-reads a file whose target was cleared…` and `drops an answer in flight when the target is cleared…` — cover the reread and the race, and **experiment T** fires exactly those two. **The sticky `fileTextShown` is deliberately unchanged**: §2.2 decided it, the review raises it as an observation rather than a required change, and the defect was the staleness. |
| 7 | Confirmation | **No action, and nothing was weakened.** The generation check and the identity-guarded getter are unchanged; the getter's guard keeps the comment experiment C earned, which says in the code that no call site can reach it. The one path the review excepted is finding 6, now closed, and closing it removed a way for a stale answer to be reused rather than adding one. |
| 8 | Follow-up | **Recorded, not fixed — deliberately, and with an owner.** It is a statement about what **Phase 2** must add, and adding it now would mean writing an invalidation for a write that does not exist and cannot be tested. It is hole 14 of §9, in both halves the review names: there is **no post-write refresh** (identity dedup suppresses the read and the `force` path is gone, so close-and-reopen is the only route), and **`RawDocumentText.text` carries no revision** and must never be a write's base. It is also in §11's inheritance list and in `PROGRESS.md`'s "What Phase 2 inherits", so the next phase meets it in the file it will actually read. |

**What the round changed:** two dictionary strings, one module (`workspace.svelte.ts` — one new
function, one branch, two call sites), and three test files. **No Rust, no wire change, no new
dependency, no dictionary key added or removed**, and the corpus untouched. **Ten test names** rewritten
to what their bodies establish, **three bodies strengthened** so a name could stay, and **three new
tests**.

**What it deliberately did not change:** the placement decision (§2), the four arms (§3), the sticky
viewer (§2.2), `documentStart`'s single caller, and the deletion of the `force` flag. One experiment
was added (T) and thirteen re-run; §7 carries the corrected counts.
