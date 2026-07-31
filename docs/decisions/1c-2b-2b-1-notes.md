# Phase 1c-2b-2b-1 — source text on the screen: the detail pane's bytes

**Status: complete, and amended by its own review.** The first half of 1c-2b-2b. The detail pane now
shows the match's own bytes and an unmodelled entry's own bytes, both through one **shared, tested
rendering primitive** that the raw YAML viewer of 1c-2b-2b-2 uses unchanged.

**This document was rewritten where the review falsified it**, not appended to: three sentences it
used to make were wrong, and §11 records finding by finding what was changed. Where a paragraph below
says "measured", the measurement is now named.

**What this sub-phase is not.** It does not call `documentText()`, it renders no whole document, and
it does not check Phase 1's exit over the real corpus. All three are 1c-2b-2b-2's. It adds **no Rust
code that reaches a screen**: every value it draws was already on the wire and nothing here widened
it. It does add **two Rust tests**, both measurements the review asked for (§5.2, §3).

**The one-sentence claim.** A run of a file's text now reaches a screen with its indentation, its
trailing spaces, its decomposed and astral Unicode and its line count intact, and with **an
enumerated set of characters that draw nothing — the C0 and C1 controls, U+2028, U+2029, a lone
carriage return, a byte order mark, the soft hyphen, the zero-width characters and the bidirectional
controls — named** rather than drawn as nothing; measured in a running window, not argued. The
enumeration is `invisibleName()` in `src/lib/browser/sourceText.ts` and this sentence claims nothing
wider than it: a joiner, a variation selector and a combining mark are deliberately outside it (§2.3),
and hole 7 lists what nobody has decided about at all.

---

## 1. What was built

**`src/lib/browser/sourceText.ts` — the rendering primitive, 380 lines and no markup.** It turns a
run of the file's text into a list of segments: `text` (a substring, untouched), `break` (one line
break, carrying whether the file wrote LF or CRLF) and `invisible` (one of the characters the
classifier enumerates, carrying a **code** and the character itself). `sourceCharacters()` rebuilds the input from the
segments, which is the module's oracle. The decisions live here rather than in a component for the
standing reason: nothing in this repository renders a Svelte component in an automated test
(`1c-1-notes.md` hole 1), so a rule written in markup is a rule no test can reach.

**`src/lib/components/SourceText.svelte` — the one component that draws file text.** It walks the
segments, draws a break as a `<br>`, draws an invisible character as a bordered marker in the
interface's own face, and puts everything else in a text node inside a `white-space: pre` container
that scrolls sideways. It takes `text` and an optional `documentStart` flag, which is the whole of
what 1c-2b-2b-2 needs from it.

**`MatchDetail.source`** — the match's own bytes, in a new *Source text* section at the foot of the
detail pane, under a sentence that says **which part of the file** this is, in prose that describes no
syntax, because not every item of a `matches` sequence has any (§3).

**`UnknownRow.value`** — an unmodelled entry's own bytes, under its existing key/shape/reason block.
**`browser.detail.unknownValue` was reworded in the same change**, because reading the field made the
old sentence false in the other direction — and reworded **again at the review**, because its
replacement was a caption above all three arms of `SourceSlice` and was false above one of them (§4).

**`SourceSlice` in `detail.ts`** — the three-arm answer to "what is in this span": `text`, `empty`
(the span is empty, so the file really writes nothing) and `unavailable` (the span is not empty and
no text arrived). That is `1c-2b-2a-notes.md` hole 7, decided rather than inherited. **What may be
said above one arm may not be said above another**, which is the rule the review's first finding
turned into a test.

**Fifteen new dictionary keys in both languages** (eleven at the sub-phase, four more at the review),
three reworded, one new token in `src/app.css` (`--font-ui`), **98 new frontend tests** and **two new
Rust tests**.

---

## 2. Decision — a rendering primitive, not a `<pre>` in the pane

The obvious implementation is `<pre>{text}</pre>` with `white-space: pre-wrap`, which is what the
scalar rows in this pane already do. It was rejected for four reasons, each of which is a way the
obvious version shows the reader a file they do not have.

1. **A CRLF is two characters and one line break.** Put `\r\n` in a text node and what happens next
   is the layout engine's business, not this project's. Splitting breaks out in TypeScript makes the
   number of visual lines a property a test asserts.
2. **A character with no glyph draws as nothing.** A document holding a NUL, a U+2028 or a stray
   byte order mark looks *identical* to one without. For an application whose entire premise is
   byte fidelity, silently drawing nothing is the worst available answer.
3. **A soft wrap is indistinguishable from a line break.** With `pre-wrap`, a long line becomes two
   visual lines and nothing says which of them the file wrote.
4. **1c-2b-2b-2 renders a whole document through the same rules.** Inlining them in `DetailPane`
   would mean writing them twice, free to drift once.

**The cost, stated once.** The primitive **replaces** an invisible character with prose on screen, so
selecting and copying the rendered text yields the words `line separator U+2028` where the file has
one character. The model keeps the character — `sourceCharacters()` proves it — and Phase 1 writes
nothing back, so nothing is corrupted by this; it is a display transformation, named here, given its
own on-screen explanation (`browser.source.invisibleDetail` as the marker's tooltip), and recorded as
hole 6.

### 2.1 `white-space: pre`, and why not `pre-wrap`

`pre` on the container, with `overflow-x: auto` and `max-width: 100%`. A long line therefore scrolls
sideways instead of wrapping. Measured in the window: the second snippet's source box reports
`scrollWidth=564 clientWidth=489`, so the box really does scroll rather than fold a line the file
wrote as one. The pane's *scalar rows* still use `pre-wrap` and were deliberately not touched
(hole 5).

### 2.2 The markup is one line, and that is load-bearing

`white-space: pre` preserves everything inside the container, so a newline written in the markup for
legibility would be a newline the file does not have. The container tag and its `{#each}` are
therefore written flush against each other, `sourceText.test.ts` asserts the exact opening and
closing sequences, and the compiled bundle was inspected: the template is
`<div class="sourceText svelte-…"></div>` with every child appended by the block — no stray text
node. Experiment J is the oracle: one newline after the opening tag fails the suite.

### 2.3 Nine names, three of which are families, and what is deliberately outside them

**Widened at the review, and the claim narrowed to match.** The sub-phase shipped six names covering
the controls, the two Unicode separators and U+FEFF, under a headline that said *every* character
with no glyph is named — so `a\u{200b}b` rendered exactly like `ab`, which is the one thing the
headline denied. Both halves moved: the classifier now covers more, and every sentence about it now
enumerates instead of generalising.

`InvisibleName` is
`bom | nul | carriageReturn | lineSeparator | paragraphSeparator | softHyphen | zeroWidth | bidi | other`,
and each string carries a `{code}` operand so the marker names the exact character. Three stand for a
family, which is why the code point is not optional:

| Name | What it covers | Why it is one name |
|---|---|---|
| `zeroWidth` | U+180E, U+200B, U+2060–U+2064, and a U+FEFF that is not at byte 0 | they occupy no width and modify nothing beside them; the code point tells them apart |
| `bidi` | U+061C, U+200E, U+200F, U+202A–U+202E, U+2066–U+2069 | they draw nothing and can reorder a whole line — the strongest reason here to name a character rather than let it work invisibly |
| `other` | every C0 or C1 control except tab and the line breaks | the catch-all it always was |

**Four kinds of character are deliberately left alone, and this is the judgement, not a formality.**

- **A tab.** It has a rendered width, so drawing it draws something. That it is then
  indistinguishable from spaces is hole 7 — a hole, not a decision.
- **The joiners, U+200C and U+200D.** A marker *replaces* the character on screen, so naming a U+200D
  inside an emoji sequence turns one glyph the file really draws into three glyphs and two markers.
  Showing the reader a file they do not have is exactly what rule 3 exists to prevent, and this would
  be a way of doing it. Seen in the window reading (§6): `join‍join` in the scratch file keeps its
  U+200D as an ordinary character, and the rendered code points hold `200d`.
- **The variation selectors, U+FE00–U+FE0F and U+E0100–U+E01EF, and the tag characters.** Each
  attaches to what precedes it and chooses how *that* character draws. Same argument.
- **Everything outside the enumeration** — a Hangul filler, a braille blank, the spaces of other
  widths. Nobody has decided about them; that is hole 7 and it says so.

The cost of the two middle bullets is stated rather than hidden: a **stray** ZWJ or variation
selector — one not part of a sequence — is still drawn as nothing. Hole 7 carries it.

**A lone carriage return is named, not treated as a break** — and this is now a decision on evidence
rather than an abstention. §5.2 measured what the substrate does: `SyntaxIndex::parse` treats a lone
CR as a line break, and a document holding one **can** parse and reach this pane. The viewer still
names it and draws no break, because a marker shows the reader the exact byte while a `<br>` would
hide the one character that makes the line unusual. The consequence is written down: for such a file,
the number of lines the viewer draws is one fewer than the number the parser sees (hole 12).

---

## 3. Decision — what the source-text section says, written from a measurement of **every** shape

`MatchView.source_text` is the slice of `MatchView.span`, and that span comes from
`SyntaxIndex::close_collection`: it starts at the collection's opening event and ends at its **last
child**. The boundary was measured rather than inferred from the field's name — and **the first
measurement was not wide enough**, which is the review's second finding. A throwaway probe had been
run over one block-sequence document; `MatchView::project` projects *every* item of a `matches`
sequence, and three other shapes falsify a sentence written from that one.

The measurement is now a **committed test** rather than a deleted probe:
`every_shape_a_matches_sequence_can_hold_is_projected_with_its_own_span` in
`crates/espansoconfig-core/tests/model_projection.rs`. What it pins:

| The file writes | `source_text` is | What that costs a sentence about syntax |
|---|---|---|
| `- trigger: ':a'` … (block item) | first key → last child; the `- ` and the indentation before it are outside | the first line renders flush left, the rest keep their own indentation |
| `matches: [{trigger: x, replace: y}]` | `{trigger: x, replace: y}` — braces included | **there is no `-` and no indentation at all** |
| `matches:\n  -` (bare empty item) | a **zero-width span**, so the slice is empty | it has neither a first character nor a last; `SourceSlice` answers `empty` and the pane draws *written as empty text* |
| `matches:\n  - just-a-scalar` | `just-a-scalar` | an item that is not a mapping still gets a row and a slice |
| a terminal **empty** value | stops before that key's `:` | the last line ends at the key name (seen on screen, §6) |

Two boundary facts hold across all of them: a comment on the line **above** is outside the slice, and
**an inline comment on one of its own lines is inside it**, because it lies between the first
character and the last. Seen on screen: `trigger: ':one'   # an inline comment, which is inside its
bytes`.

The sentence on screen is therefore, since the review:

> The part of the file this app reads as the snippet itself. What surrounds it in the list, the
> indentation in front of it and any comment before or after it are outside it.

It **names no syntax**: no dash, no braces, no first or last character — because the first two may not
exist and the third may not either. It is a noun phrase followed by what is outside, which stays true
of a flow item (nothing surrounds it but a bracket and a comma), of an empty item (nothing at all),
and of a block item (a marker and an indent). The withdrawn sentence claimed all three.

---

## 4. Decision — the two halves that had to travel together

`src/lib/browser/detail.ts` deliberately did not read `UnknownEntry.value_text` at 1c-2b-2a, so that
`browser.detail.unknownValue` — *"holds {kind}, which this pane does not show"* — stayed true.
Reading it makes that sentence false in the other direction, which is the 1c-2a review's first
finding reflected in a mirror. Both halves moved in this change:

| | before | after (sub-phase) | after (review) |
|---|---|---|---|
| `UnknownRow` | no value field | `value: SourceSlice` | unchanged |
| `browser.detail.unknownValue` (en) | holds {kind}, which this pane does not show | holds {kind}, shown here as the file writes it | **holds {kind}** |
| `browser.detail.unknownValue` (es) | contiene {kind}, que este panel no muestra | contiene {kind}, que se muestra aquí tal y como lo escribe el archivo | **contiene {kind}** |
| the "as written" claim | — | in the caption, above all three arms | **`browser.detail.valueAsWritten`, inside the `text` arm only** |
| `detail.test.ts` scan | `not.toContain('value_text')` | `toContain('slice(entry.value)')` | plus a **position** assertion on the claim |

### 4.1 The review's first finding: a caption above three arms

The replacement sentence was true of the arm the reviewer's eye fell on and false of another.
`SourceSlice` has three arms; with `value_text: ""` and a non-empty `value_span` the pane drew *holds
a single value, shown here as the file writes it* and, on the very next line, *This app could not read
these bytes.* One caption, two contradictory claims, and the rule this sub-phase existed to honour is
precisely **do not claim on screen what the app does not do**.

The fix is structural rather than verbal: a caption that has to be true of every arm may only say what
is true of every arm. So `unknownValue` says **only what shape the value has** — the one thing that
holds whether the bytes arrived, were empty or could not be read — and the "shown here as the file
writes it" claim moved **inside the `text` arm**, where it is the caption of the bytes it is about.
The `empty` arm keeps *written as empty text*; the `unavailable` arm keeps *This app could not read
these bytes*. Each arm now carries one sentence and it is true of that arm.

**The guard is mechanical and now has three parts.** `detail.test.ts`'s suite *the two halves that may
only travel together* writes out **both** withdrawn sentences — the 1c-2a one and the one this review
withdrew — and asserts each is gone; asserts the caption still carries `{kind}` and almost nothing
else, so a future sentence cannot quietly grow a claim back into it; and the pane scan asserts the
as-written claim's **position**: after the `{#if one.kind === 'text'}` and before the `empty` arm,
exactly once. Experiment N (the claim moved back above the `{#if}`) fails that last one by name.

**Four sentences were checked and deliberately *not* changed.** `1c-2b-2a-notes.md` §10 predicted
that "the four `code.unknownReason.*` sentences stop being true as written" the moment the value went
on screen. That prediction was checked against the strings rather than inherited, and it is **wrong**:
each says the entry *was recorded and is kept exactly as the file writes it*, which is a claim about
what this app does to the file, not about what is on screen. `browser.detail.unknownCount.*`
("recorded and left untouched") is the same case. They stand unchanged.

---

## 5. The fidelity table, rendering column

§4 of `1c-2b-2a-notes.md` gives every byte hazard, what it does at the wire, and what pins it. This is
the column that was empty. **"Detail pane" means what a *slice out of the middle of a file* can carry;
"whole document" means what only 1c-2b-2b-2's viewer can show.**

| Hazard | What rendering does | Reachable in the detail pane? | Pinned by |
|---|---|---|---|
| CRLF line endings | **one** line break, and the CR never enters the DOM | **yes**, and seen: the first snippet's unmodelled block value drew `br=2` for its LF and its CRLF, and the rendered code points hold no `0d` | `draws one break for a CRLF, not two`; `records which characters the file used`; the window reading (§6) |
| Interior indentation | preserved (`white-space: pre`) | **yes**, seen: `      two real spaces end this line` | `keeps interior indentation and real trailing spaces`; the reading's code-point dump |
| Real trailing spaces | preserved in the DOM; **invisible to the eye**, as trailing spaces are anywhere | **yes**, seen: the rendered text node ends `… line` + `20 20` | as above (hole 4) |
| Precomposed `é` (U+00E9) | untouched | **yes**, seen as `e9` | `keeps a decomposed é decomposed…`; the reading |
| Decomposed `é` (U+0065 U+0301) | untouched, **uncomposed** | **yes**, seen as `65 301` beside the `e9` above | as above; experiment D (an `NFC` normalise) fires it |
| Astral `😀` (U+1F600) | untouched, never split | **yes**, seen as one code point `1f600` | `keeps an astral character whole`; `splits nothing through the middle of a surrogate pair`; experiment C fires both |
| Line separator (U+2028) | **named**: `line separator U+2028`, and the character never reaches layout | **yes**, seen in both languages | `names " "`; the reading |
| Paragraph separator (U+2029) | **named**: `paragraph separator U+2029` | **yes**, seen in both languages | as above |
| NUL (U+0000) | **named**: `null character U+0000` | **no**, and the reason was re-measured at the review (§5.2): inside a quoted scalar it fails the parse, and inside a plain one the parse **succeeds and stops there**, so the NUL and everything after it fall outside every node span. Either way no slice carries one; only a whole-document surface could show one | `which_control_characters_can_reach_a_projected_slice`; hole 1 |
| Other C0/C1 control | **named**: `invisible character U+0007` | **yes — the note that said "no" was wrong.** U+0007, U+001B, U+007F, U+0085 and U+009F all parse in a plain value and land **inside** the match's own span, so the source-text section really can draw one. Nothing has drawn one on a screen yet (hole 1) | `which_control_characters_can_reach_a_projected_slice`; the naming cases in `sourceText.test.ts` |
| Lone carriage return | **named**, and **no break drawn** | **yes, measured** — the substrate treats a lone CR as a line break, so whether a document holding one parses depends on what follows it; with the next line properly indented it parses and the CR is inside the match's slice. The viewer then draws one line where the parser sees two (hole 12) | `which_control_characters_can_reach_a_projected_slice`; `does not call a lone carriage return a line break` |
| Leading UTF-8 BOM | named `byte order mark U+FEFF` **only when the caller says the text starts a document** | **no, by construction** — the detail pane never passes `documentStart`, because a slice cannot know where byte 0 is. A U+FEFF in a slice renders as `zero-width character U+FEFF`, which is what it is there | the three cases of *the byte order mark, which only a whole document can have*; **1c-2b-2b-2 owns the true BOM row** |
| Zero-width characters (U+180E, U+200B, U+2060–U+2064) | **named**: `zero-width character U+200B` | **yes**, and seen on screen in both languages (§6) | the `names %j as its family` cases; the window reading |
| Bidirectional controls (U+061C, U+200E–U+200F, U+202A–U+202E, U+2066–U+2069) | **named**: `text direction control U+202E` | **yes**, and seen on screen in both languages (§6) | as above |
| Soft hyphen (U+00AD) | **named**: `soft hyphen U+00AD` | **yes**, and seen on screen in both languages (§6) | as above |
| Joiners (U+200C, U+200D), variation selectors, combining marks | **drawn as themselves, deliberately** (§2.3) — each modifies the character beside it | reachable and **not marked**, so a stray one is invisible (hole 7). Seen: the scratch file's joined pair kept its `200d` in the rendered code points | the `leaves %j alone` cases; the window reading |
| No final newline | nothing is added; the last segment is text | **not observable here**: a match slice ends at its last value, so it never carries a final newline either way. **Whole document** | `ends without a break, because the fixture ends without a newline` |
| Mixed line endings in one file | each break is drawn as one break; **which** ending it was is carried on the segment and **not rendered** | partly: a match slice can hold both. Showing the difference is 1c-2b-2b-2's, and the data is already there | hole 3 |
| Not valid UTF-8 at all | never reaches a screen — the command refuses with `notUtf8` | **no**: this sub-phase calls no raw-text command | 1c-2b-2a §3.1; **1c-2b-2b-2 owns the refusal's screen** |

### 5.1 What the window reading adds that no test can

`mock_builder()` swaps the platform webview out, so every measurement before this sub-phase stopped
at Tauri's encoder (`1c-2b-2a-notes.md` §4.3). The reading in §6 is the first evidence in this project
about **WKWebView**, and it is narrow and worth stating exactly: the rendered DOM held `65 301`
uncomposed, `1f600` as one code point, two trailing spaces, and no `0d` anywhere; `white-space`
computed to `pre`; and the two Unicode separators never reached the engine at all, because the
primitive had already replaced them. That last point is why this design answers the U+2028 row rather
than merely reporting what WebKit did with it.

### 5.2 What a control character really does to a parse, measured

**The review's fourth finding: three rows above rested on one measurement.** 1c-2b-2a had measured a
NUL, and the sub-phase generalised from it to "a lone CR and the other C0/C1 controls" without asking.
`which_control_characters_can_reach_a_projected_slice` in
`crates/espansoconfig-core/tests/model_projection.rs` now asks, and the answer is more interesting
than the guess:

| Input | What `SyntaxIndex::parse` does | Can it reach the pane? |
|---|---|---|
| U+0007, U+001B, U+007F, U+0085, U+009F in a plain value | parses, character and all | **yes** — it is inside the match's own span, and inside an unmodelled entry's `value_text` |
| a lone CR with the next line properly indented | parses; the CR **is a line break** to the parser | **yes** — it is inside the match's span |
| a lone CR before a line that lands at the wrong indentation | fails: *simple key expect ':'* | no, for that document |
| a NUL in a plain value | parses, and **stops at the NUL**: the scalar ends there and the rest of the file becomes trivia | **no** — the NUL is outside every node span |
| a NUL in a quoted scalar | fails: *while scanning a quoted scalar, found unexpected end of stream* | no |

Two consequences beyond the table. **A NUL silently truncates a document** — the file parses, and the
matches after the NUL are simply not there. That is the substrate's behaviour, not this sub-phase's,
and it is written down here because nothing else in the project had noticed it; whether the browser
should say so is 1c-2b-2b-2's question, where `document_text` meets a file the projection stopped
early on. And **U+0085 is not a line break to this parser**, though YAML 1.1 calls it one — it survives
into a scalar as an ordinary character, which is why it is in the "reaches the pane" row rather than
in the line-ending discussion.

The frontend's own fixture followed the measurement: `PARSEABLE_HAZARDS` in
`src/lib/browser/fixtures.ts` now carries a BEL, a lone CR and a U+200B, because those are things a
value in a document that parses can really hold.

---

## 6. The window reading, re-taken after the review's fixes

**The reading below replaces the sub-phase's own.** Every string this round changed is a string a
component renders, and nothing in this repository renders a Svelte component in an automated test, so
the previous reading became evidence for a screen that no longer exists the moment the dictionary
changed. It was re-taken whole.

Taken by the technique of `1c-1-notes.md` §10: `npm run build`, then
`cargo build -p espansoconfig --features custom-protocol`, the binary in a hand-assembled
`espansoConfig.app` (`Contents/MacOS` + `Info.plist`), ad-hoc signed, launched through LaunchServices
with `open --env XDG_CONFIG_HOME=<scratch> --env HOME=<scratch> --stdout <log>`. A temporary
`render_probe` command in `src-tauri/src/main.rs` and a driver in `src/main.ts` reported the rendered
DOM, then clicked each snippet row in turn and reported again. **Both files were restored from
byte-identical copies afterwards** (`diff` shows no difference) and the whole verification suite
re-run (§8).

**`cargo build` followed `npm run build` before every launch**, per the rule 1c-2b-1 added — the
`custom-protocol` feature embeds `dist` in the binary, so a window opened after only a `vite build`
shows the previous bundle.

**The configuration read was synthetic and hand-written for this run**, in a scratch directory: two
files, one `matches:` block sequence of two snippets (a comment above the first, an inline comment on
its own line, a block scalar with two real trailing spaces and a CRLF, a decomposed and a precomposed
`é`, an astral emoji, one key with no value at all, and a value carrying U+200B, U+00AD, U+202E and
U+200D), and one file written as a **flow sequence** so the scope sentence could be read over an item
with no list marker. `XDG_CONFIG_HOME` and `HOME` both pointed into the scratch tree, so the owner's
real configuration was never opened. **No real configuration content appears in this document, in any
test or in any committed file** (D1).

**Two things about the instrument, stated because they cost time.** The application's language follows
`navigator.languages` in the webview, which on this machine ignored both `-AppleLanguages` and a
`defaults write` against the bundle identifier; the language was therefore switched **through the
application's own picker**, which needs a *bubbling* `change` event because Svelte 5 delegates that
event — a non-bubbling one silently does nothing. And a WKWebView whose window is not frontmost
throttles timers hard enough to look like a hang: the app has to be activated for a long probe to
finish.

**Reading 1 — English, the first snippet** (`innerText`, elided only where it repeats):

> File / match/base.yml / TRIGGER / Trigger form: One trigger / Trigger `:one` / Written between
> single quotes / CONTENT / Content form: Replacement text / Replacement text *(the value)* / ENTRIES
> THIS APP DOES NOT MODEL / 1 entry was recorded and left untouched. /
> `invented_by_a_later_espanso` / **holds a single value** / espansoConfig has no field for this key,
> so the entry was recorded and is kept exactly as the file writes it. / **shown here as the file
> writes it** / *(the value, two lines)* / SOURCE TEXT / **The part of the file this app reads as the
> snippet itself. What surrounds it in the list, the indentation in front of it and any comment
> before or after it are outside it.** / **shown here as the file writes it** / *(the slice, five
> lines)*

and the instrumented numbers:

```
box[0] br=2 markers=0  whiteSpace=pre  scrollW=357 clientW=357
       points=20 20 20 20 20 20 74 77 6f … 6c 69 6e 65 20 20 | 20 20 20 20 20 20 61 6e 64 …
box[1] br=5 markers=3 [zero-width character U+200B | soft hyphen U+00AD | text direction control U+202E]
       whiteSpace=pre  scrollW=564 clientW=506
       points=… 6a 6f 69 6e 200d 6a 6f 69 6e …
```

**The three new markers are on a screen**, each naming its own code point. Two breaks for two line
endings one of which is a CRLF, and **no `0d` in the rendered text**; the two trailing spaces present
as `20 20`; the first line of the slice flush left and the rest indented four; the box scrolls
(`scrollW` 564 > `clientW` 506) rather than wrapping. And the `200d` in the last line is the
**joiner left alone on purpose** (§2.3) — it is in the DOM as a character, not as a marker.

**Reading 2 — English, the second snippet.** The unmodelled entry `a_fourth_key_with_nothing_in_it`
reads *holds a single value* and then **written as empty text** — and **no "shown here as the file
writes it" above it**, which is the whole of the review's first finding, seen. The source box:

```
box[0] br=2 markers=0  points=74 72 69 67 67 65 72 … 63 61 66 65 301 20 63 61 66 e9 20 1f600 22 …
```

`65 301` and `e9` side by side, uncomposed; `1f600` whole; and the slice ends at
`a_fourth_key_with_nothing_in_it` **without the colon**, which is where the mapping node's span ends
(§3).

**Reading 3 — English, the flow-sequence snippet.** The one the old scope sentence lied about:

> File / match/flow.yml / … / SOURCE TEXT / The part of the file this app reads as the snippet
> itself. … / shown here as the file writes it / `{trigger: ':flow', replace: 'written as a flow
> item'}`

```
box[0] br=0 markers=0  points=7b 74 72 69 67 67 65 72 … 7d
```

The slice opens with `7b` — a brace — and there is **no `-` and no indentation anywhere on the
screen** for the sentence above it to have described.

**Reading 4 — Spanish** (the picker set to *Seguir el idioma del sistema* on a Spanish machine), the
same three snippets:

> TEXTO DE ORIGEN / **La parte del archivo que esta aplicación considera el fragmento en sí. Lo que lo
> rodea en la lista, la sangría que lo precede y cualquier comentario anterior o posterior quedan
> fuera.** / **se muestra aquí tal y como lo escribe el archivo** / *(the slice)* … / **contiene un
> valor suelto** / **escrito como texto vacío**

with the markers as `carácter de ancho cero U+200B`, `guion discrecional U+00AD` and
`control de dirección del texto U+202E`. The file's own text stayed English throughout, which is
correct — it is the file's text, not the interface's.

**What the reading is evidence of:** what WebKit laid out and what the DOM held, read as text and as
code points. **What it is not:** pixels. It cannot see a marker painted the same colour as its
background. That remains `1c-1-notes.md` hole 6.

---

## 7. The disabling experiments

**Thirteen at the sub-phase and four more at the review**, each performed by breaking the
**implementation** and observing which tests fired, each reverted before the next, with the suite
green again in between. Every touched file was compared with a byte-identical copy at the end (§8).
Experiment G below still fires: the withdrawn 1c-2a sentence is still written out and still asserted
gone, and the review added the second withdrawn sentence beside it.

| # | The break | What fired |
|---|---|---|
| A | `sourceSegments` loses its `\r\n` branch, so a CRLF is a named CR plus a break | **3**: `draws one break for a CRLF, not two`, `records which characters the file used`, `names each invisible character exactly once`. **The round trip did not**, which is the point of having both: `\r` + `\n` still rebuilds to `\r\n` |
| B | An invisible character becomes an empty text segment instead of a named one | **19**, including every round-trip case that holds one |
| C | The scanner advances by one UTF-16 unit instead of one code point | **4**: the astral round trip, `keeps an astral character whole`, `splits nothing through the middle of a surrogate pair`, and the whole-fixture round trip |
| D | The scanner normalises its input with `String.normalize('NFC')` | **2**: `keeps a decomposed é decomposed and a precomposed é precomposed`, and the whole-fixture round trip |
| E | `sourceSlice` answers `empty` for any empty text, dropping the span check | **2**: `is unavailable when the span is not empty…`, `tells an empty value apart from one it could not read` |
| F | `describeUnknown` stops reading `value_text` | **4**, including `carries the value on the model, which is what made the sentence false` — the second half of the two-halves guard |
| G | `browser.detail.unknownValue` restored to its withdrawn English sentence | **1**: `no longer says the pane does not show an unmodelled value` |
| H | `DetailPane.svelte` stops rendering `{@render slice(entry.value)}` | **1**: `says what shape an unmodelled entry holds, and draws its value` |
| I | `SourceText.svelte` switched to `white-space: pre-wrap` | **1**: `does not wrap, so a soft wrap cannot pass for a line the file does not have` |
| J | A newline inserted after `<div class="sourceText">` | **1**: `opens the container with no whitespace of its own before the file’s text` |
| K | `browser.source.invisible.nul` deleted from `es.json` | **`npm run check`**: 4 errors, the first naming the missing key at `dictionaries.ts` |
| L | `'nul'` deleted from `EVERY_INVISIBLE_NAME` | **`npm run check`**: `Type '"nul"' does not satisfy the constraint 'never'` — the exhaustiveness alias, naming the member |
| M | `tInvisible` stops passing the `{code}` operand | **1**: `leaves no placeholder unsubstituted when the accessor renders one` |
| **N** | the as-written claim moved out of the `text` arm, above the `{#if}` — i.e. the defect the review found, put back | **1**: `claims the bytes are the file’s own inside the text arm and nowhere else` |
| **O** | `'bidi'` deleted from `EVERY_INVISIBLE_NAME` | **`npm run check`**: `Type '"bidi"' does not satisfy the constraint 'never'`, naming the member |
| **P** | the classifier loses its bidi branch, so U+202E is drawn as nothing again | **9**: the eight bidi `names %j as its family` cases and `keeps every named character in source order when they run together` |
| **Q** | `browser.source.invisible.zeroWidth` deleted from `es.json` | **`npm run check`**: 4 errors, the first naming the missing key at `dictionaries.ts` |

Two of these are worth a sentence each. **A is the reason the break count is asserted separately from
the round trip**: the oracle that proves nothing is *lost* cannot notice a change in how many lines
are *drawn*. **J is the reason the markup is scanned for its exact opening sequence**: nothing else in
this repository would notice a reformat that inserts a newline into a `white-space: pre` box, and the
result would be a blank first line in every source view in the application. **N is the review's first
finding turned into an oracle**: the defect was a sentence in the right file with the wrong *position*,
which no presence assertion could ever have caught.

---

## 8. Verification

**Re-run in full after the review's fixes; these are the numbers as they now stand.**

| Command | Result |
|---|---|
| `npm run check` | **0 errors, 0 warnings**, 372 files |
| `npm test` | **583 passed**, 26 files (485 before the sub-phase; **+60** at the sub-phase, **+38** at the review — 30 in `sourceText.test.ts`, 8 in `detail.test.ts`) |
| `npm run build` | ok, `dist/assets/index-Dq9SdsXJ.js` 109.11 kB |
| `cargo build --workspace` | ok |
| `cargo test --workspace` | **561 passed, 0 failed**, across 16 binaries (559 before; **+2**, both measurements the review asked for) |
| `cargo clippy --workspace --all-targets -- -D warnings` | clean |
| `cargo fmt --check` | clean |
| `cargo tree -p espansoconfig-core \| rg tauri` | **no output** — the architecture rule holds (D2x) |

**Counts.** 240 dictionary keys in each language (226 before the sub-phase, 236 after it): **15 new** —
`browser.detail.section.source`, `browser.detail.sourceScope`, `browser.detail.valueUnavailable`,
`browser.detail.valueAsWritten`, `browser.source.invisibleDetail` and the nine
`browser.source.invisible.*` — plus **three reworded**: `browser.detail.unknownValue` (twice, §4),
`browser.detail.sourceScope` and `browser.source.invisibleDetail`. No new key is identical between the
two languages, so `IDENTICAL_BY_DESIGN` in `dictionaries.test.ts` is untouched. Placeholder parity
holds by that file's own check.

**The probe was reverted and the tree verified.** `src/main.ts` and `src-tauri/src/main.rs` were
restored from copies taken before the probe was added and compared with `diff` — identical, at the
sub-phase and again after the review's re-taken reading. Every file a disabling experiment touched
(A–M at the sub-phase, N–Q at the review) was compared the same way, and the throwaway Rust probe
that measured §3 and §5.2 was deleted once its findings became the two committed tests. `dist/` was
rebuilt from the reverted source before the final verification run above.

### 8.1 R31 — the blind spots, by name

`scripts/lint/hardcoded-strings.ts` reads `.svelte` **markup** only. A clean run means "no literal is
sitting in markup", and here is what it did not look at in this change:

1. **`<script>` blocks**, whole. Both components' script blocks are masked before scanning, including
   `SourceText.svelte`'s new one.
2. **`.ts` files** — `sourceText.ts`, `detail.ts`, `index.ts`, `fixtures.ts`, all four test files.
   The scanner reads none of them. The new prose in them is JSDoc and comments.
3. **Component doc comments**, masked with the block they sit in.
4. **Text reaching the screen through a prop**: `SourceText`'s `text` prop is exactly that, and it is
   the file's own text rather than an interface string, which is the case the rule is not about.
5. **The two new markers' punctuation and layout**, which are CSS. `src/app.css` and both `<style>`
   blocks contain no `content:` rule, so no string reaches a screen through CSS.
6. **`scripts/lint/built-translation-keys.ts` does cover the new component** — it scans every
   `.svelte` file under `src/` and refuses any `t(` whose key is not written literally. The new
   component's only `t(` call is a literal key, and its code is rendered through `tInvisible`.

**The review round's one markup change is inside the scanner's field of view**, which is worth saying
because most of what it changed is not: the new `<span class="marker">` in the `text` arm of `slice`
is markup, holds a literal `t('browser.detail.valueAsWritten')` and no literal prose, and both linters
pass. Everything else the round touched — the classifier, its ranges, the two Rust tests, the doc
comments — is in files neither linter reads.

### 8.2 The claim-versus-data sweep

Every sentence written here that asserts something about data was checked against the data first, and
the check found three things worth recording:

- the boundary of `MatchView.source_text` — measured with a throwaway probe rather than inferred, and
  the measurement changed the sentence twice (§3): "first key to last value" was rejected because a
  non-mapping `matches` item makes it false, and "comments are not part of it" was rejected because
  an inline comment *is*. **This sweep is the one that failed**, and it is worth being exact about
  how: the probe was run over one document, so the sentence that survived it described the shape that
  document had. A measurement of one example is not a measurement of the set, and the review found
  three shapes the sentence was false of (§3). The replacement measurement is a committed test over
  every shape rather than a probe over one;
- `1c-2b-2a-notes.md` §10's prediction about the four `code.unknownReason.*` strings, which was
  checked and found **wrong** (§4). Nothing was changed on the strength of it;
- the ten-year-old habit this project keeps catching: a test's *name* against its *body*. Every new
  test name here was re-read against what its body could fail on. The one that failed that reading
  was an early `renders …` name on a suite that only reads a file's text; it is now
  *the source of the component that renders these segments*, and its doc block says a text scan is
  all it is.

---

## 9. Coverage holes, stated as holes

1. **Nothing has drawn a control character or a lone CR on a screen** — and the sub-phase's reason for
   that was wrong, which the review caught and §5.2 measured. Only the **NUL** half survives: a NUL
   never lands in a slice, because a quoted one fails the parse and a plain one stops it. Every other
   C0 or C1 control, U+0085 and a lone carriage return **can** reach the detail pane; the primitive
   names them and `sourceText.test.ts` covers them, but no window reading has yet shown one, because
   the scratch configuration of §6 carries the newly-named characters rather than a control. That is
   a hole in the *evidence*, not a claim about reachability. The BOM is a different case again — the
   detail pane never passes `documentStart`, by design.
2. **No test renders `SourceText.svelte`.** `1c-1-notes.md` hole 1, unchanged and now load-bearing in
   a new place: the component that draws every byte is the one nothing instantiates. The evidence
   that it renders is §6, taken by hand, and it must be re-taken after any change to it.
3. **Mixed line endings are invisible.** Each break draws as one break, and the segment carries
   `lf`/`crlf` that nothing renders. A file with both looks uniform. The data is there for
   1c-2b-2b-2 to use, along with `DocumentView.line_ending`.
4. **A trailing space is preserved and still invisible.** The DOM holds it — the reading's code points
   prove it — but a space has no glyph, so a reader cannot see that a block scalar's line ends with
   two of them. Marking it is a future decision with its own noise cost; it is not made here.
5. **The pane now renders file text two different ways.** The new source and value surfaces go through
   the primitive; the **scalar rows do not** — they still print `ScalarView.text` into a `pre-wrap`
   `<pre>`. So a U+2028 inside a `replace:` value is named in the source-text section and drawn as
   nothing in the replacement-text row, on the same screen. That is an inconsistency rather than a
   false claim (nothing in the row asserts the text is complete), and it was judged out of this
   sub-phase's stated scope. Routing the scalar rows through `SourceText` is the obvious next step and
   would touch every row in the pane.
6. **What is copied is not what the file holds, where a marker is drawn.** §2's stated cost. Phase 1
   writes nothing back, so nothing is corrupted; an editing phase that offers "copy the source" must
   copy from the model, not from the selection.
7. **What the classifier still leaves invisible, after the review widened it.** Three groups, each for
   its own reason:
   - **a tab**, which has a width, so drawing it draws something — but is indistinguishable from
     spaces, and YAML forbids it for indentation, so it is worth seeing and is not seen;
   - **a stray joiner (U+200C, U+200D), variation selector or combining mark.** These are excluded on
     purpose (§2.3) because naming one breaks a glyph the file really draws. The cost is that one
     *not* part of a sequence draws nothing and is not marked;
   - **everything outside the enumeration**: a non-breaking space and the other space widths, a Hangul
     filler, a braille blank, the invisible Hangul jamo fillers. Nobody has decided about these; they
     are not covered and this says so rather than implying they are.
8. **`SourceSlice`'s `unavailable` arm has still never been on a screen**, and the review round did
   **not** close this. It is unreachable except through a defect: `value_text` is empty only for an
   empty value or a span that could not be cut. The model half is tested (experiment E, and
   `is unavailable when the span is not empty and no text came with it`), and what the review changed
   is that the arm is no longer captioned by a sentence that contradicts it (§4.1) — which is a
   different thing from having seen it. Nothing in this project renders a Svelte component in an
   automated test, so the only instrument that could close this is a window reading of a **defect**,
   which would mean shipping one. It stays a named hole; `detail.test.ts` says so at the assertion.
9. **Nothing measures what a large document costs this primitive.** One segment per invisible
   character and one `<br>` per line is fine for a match slice — the largest in the reading was five
   lines — and is an open question for a whole document. `1c-2b-2a-notes.md` hole 10 (an uncapped
   `value_text`) lands here, and 1c-2b-2b-2 is where it will be met.
10. **Nothing establishes that the Spanish strings are Spanish.** The untranslated-value check
    establishes non-identity only. Fifteen new strings and three reworded ones were written in Spanish
    and read on screen by their author; a bilingual reviewer remains the only instrument that closes
    this. *Guion discrecional* for the soft hyphen and *control de dirección del texto* for the bidi
    family are the two most likely to want a second opinion.
11. **The window reading is not pixels.** It reads the DOM and the computed `white-space`, so it
    cannot see a marker whose colours make it unreadable, or a source box clipped by a parent.
12. **A lone carriage return makes the viewer's line count differ from the parser's.** §5.2 measured
    that the substrate reads a lone CR as a line break; the viewer names it and draws no break, so
    such a file shows one visual line where YAML sees two. Nothing is hidden — the marker is there —
    but the two readings of the same file disagree, and 1c-2b-2b-2, which draws whole documents with
    line numbers in view, is where that has to be decided rather than noted.
13. **A combining mark straight after a named character is drawn on its own.** The scanner ends the
    text run at the named character, so `a\u{200b}\u{301}b` puts the combining acute at the head of a
    new text node, next to a marker — where it will attach to whatever the engine finds before it.
    Order and round trip are asserted (`starts a fresh text run after a named character, combining
    mark and all`); how it *looks* is a pixel question and hole 11 owns it.

---

## 10. What 1c-2b-2b-2 inherits, and should not rebuild

- **`sourceSegments(text, atDocumentStart)` and `SourceText.svelte`.** A whole document is the same
  call with `documentStart` set — which is the *only* way a `bom` segment is ever produced. Do not
  write a second renderer for file text, and do not re-slice by span in JavaScript (`1c-2b-2a-notes.md`
  §4.2).
- **The fidelity table's rendering column (§5), with its "detail pane / whole document" split**, and
  §5.2's measurement under it. Three rows are open because a *slice* really cannot exhibit them — a
  NUL, the true BOM and no final newline — and two are open only for want of a screen: the other
  controls and a lone CR **can** reach a slice, and a whole-document viewer will meet them sooner.
- **`SourceSlice` and its three arms.** `document_text` has a fourth case the detail pane does not —
  a typed `notUtf8` refusal, which has **no string yet** (`1c-2b-2a-notes.md` hole 8). A file the raw
  pane cannot show must not look like an empty one, and `browser.detail.valueUnavailable` is the
  nearest existing sentence to model it on.
- **The two-halves guard in `detail.test.ts`.** Its shape generalises: when a string on screen is a
  claim about what the app does *not* do, the assertion that it is gone belongs beside the change that
  makes it false.
- **`--font-ui` in `src/app.css`.** New here, beside `--font-mono`, so a marker drawn inside a run of
  the document's text can say "this is the app talking" by changing face. Both are stated once.
- **`EVERY_TEXT_HAZARD` and `PARSEABLE_HAZARDS` in `src/lib/browser/fixtures.ts`.** The first is every
  hazard in one run of text; the second is the subset a document that **parses** can carry. A test
  about `value_text` may only use the second, and the reason is a measurement, not a guess.
- **Two holes 1c-2b-1 left and neither half of 1c-2b-2b has touched**: hole 16 (the empty snippet list
  and its explanation come from unrelated code) and hole 2 (a file that failed to parse shows `0`
  exactly like an empty one).
- **Phase 1's stated exit is still unchecked.** *The owner can browse their entire real config and
  every snippet renders correctly* is a claim about a running window over the **real** corpus. This
  sub-phase read a scratch configuration of two snippets. D1 governs how the real one is recorded:
  counts and error positions, never content.

---

## 11. The review of this sub-phase, finding by finding

Four findings, no blocking ones. The sub-phase was **held open** until each was closed, so no commit
carries the demonstrated defect. What follows is what each one was and what was done about it.

**Major 1 — `browser.detail.unknownValue` claimed a thing that was false in one of three arms.**
The caption above an unmodelled value said the bytes were *shown here as the file writes it*, above
all three arms of `SourceSlice`; with `value_text: ""` and a non-empty span, the very next line read
*This app could not read these bytes.* **Closed** by splitting the sentence: `unknownValue` now says
only *holds {kind}*, and the as-written claim moved into the `text` arm as
`browser.detail.valueAsWritten`, in both languages (§4.1). The two-halves guard keeps the old
withdrawn sentence and gained the newly withdrawn one, a shape assertion on the caption, and a
**position** assertion on the claim; experiment N fires. Seen on screen in both languages (§6,
readings 1, 2 and 4): the empty arm now carries *written as empty text* and nothing else.
**The sub-finding was not closed and is not pretended to be**: the `unavailable` arm's string has
still never been read in place, because nothing here renders a component in a test and the arm is
reachable only through a defect. It stays hole 8, restated at the test that touches it.

**Major 2 — the scope sentence assumed a shape not every match has.** It described a list marker and
an indentation that a flow item does not have, and a first and last character that a zero-width span
does not have. **Closed** by measuring every shape `MatchView::project` can produce — a committed
test, `every_shape_a_matches_sequence_can_hold_is_projected_with_its_own_span` — and writing prose
that names no syntax at all (§3), in both languages. Read on screen over a real flow-sequence item
(§6, reading 3), where the slice begins with a brace and no marker appears anywhere.

**Major 3 — the headline claim was wider than the classifier.** "Every character with no glyph is
named" was false of U+200B and its neighbours. **Closed on both sides.** The classifier gained the
soft hyphen, the zero-width characters and the bidirectional controls, under three new names, with
tests for every newly named character, for the round trip over them, for their order, and for the
characters deliberately left out; the prose in the module header, in this document's headline and in
§2.3 now enumerates and states what is outside the set and why (a joiner and a variation selector
modify their neighbour, so naming one breaks a glyph the file really draws). `browser.source.invisibleDetail`
was narrowed to a claim about *this* character rather than a policy about all of them. Three new
markers read on screen in both languages, with the U+200D beside them left alone as designed (§6).

**Minor 4 — an unproven claim in the notes.** "A lone CR and the other C0/C1 controls cannot reach the
detail pane" rested on a measurement of a NUL alone. **Closed by measuring**, and the answer changed
three rows of §5 and hole 1: the other controls and U+0085 parse and land inside a match's span, a
lone CR does too when the following line is indented, and only the NUL is genuinely unreachable — for
a reason that is also not the one the note gave (§5.2). The measurement is
`which_control_characters_can_reach_a_projected_slice`, and `PARSEABLE_HAZARDS` in the frontend
fixtures followed it.

**What the round did not touch.** Nothing in `crates/espansoconfig-core/src` changed — the two new
Rust items are tests. No wire type changed. The three things the Phase 0 gate does not license are
untouched, and Phase 1's stated exit is still 1c-2b-2b-2's.
