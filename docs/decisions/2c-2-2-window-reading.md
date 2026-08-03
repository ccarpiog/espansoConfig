# Phase 2c-2-2 — the window reading

The third of the three kinds of evidence `docs/decisions/2c-split-notes.md` §7 requires of every
2c sub-phase, taken over `src/lib/components/MatchEditor.svelte` and the `DetailPane.svelte`
changes that draw it. Model tests and the mounted-component test are 2c-2-2's own; this file is
the record of **what a screen actually did**.

**Nothing here was inferred from the test suite.** Every line quoted below came out of a running
WKWebView, and every claim about a file's bytes was checked with `cmp`, `diff` or an anchored
byte-for-byte reconstruction — never by reading the panel the application drew about itself.

---

## 1. The setup

The technique is `docs/decisions/1c-1-notes.md` §10 with the constraint of
`docs/decisions/1c-2b-2b-2-notes.md` §6.1 unchanged.

```sh
npm run build
cargo build -p espansoconfig --features custom-protocol
# binary into a hand-assembled espansoConfig.app (Contents/MacOS + Info.plist), ad-hoc signed
open --env "ECFG_PROBE_PLAN=<plan>" \
     --env "XDG_CONFIG_HOME=<scratch>/xdg" \
     --env "HOME=<scratch>/home" \
     --stdout <scratch>/probe.log --stderr <scratch>/probe.err \
     <scratch>/espansoConfig.app
```

**One plan per launch, into a fresh bundle path, over a freshly rebuilt configuration.** Eleven
launches. A temporary `probe_plan` command reads `ECFG_PROBE_PLAN`; a temporary `render_probe`
prints the transcript to stdout; a `setTimeout` in `src/main.ts` drives one plan 700 ms after
mount. **Every launch reached its own `--- end`**, and every `probe.err` was zero bytes, so no
transcript below is a partial run rounded up to a conclusion.

The probe reaches the screen the way a person does — `HTMLElement.click()` on a real control, and
for a text box a `value` assignment followed by a bubbling `input` event, which is the path
`MatchEditor.svelte`'s `oninput` takes. What it does not exercise is pointer hit-testing and
pixels; §7 says so as a hole rather than leaving it implied.

### 1.1 The configuration

**Synthetic, hand-written for this run, in a scratch directory outside the repository**, and
rebuilt from scratch before every launch — this phase's screen writes files, and a reading must
not stand on the previous reading's bytes. Five files:

| File | What it is for |
|---|---|
| `config/default.yml` | a profile, so the sidebar has one |
| `match/cr.yml` | plan 1 — `replace: "a\rb"` written with a **two-character escape**, so the file holds no `0d` byte at all and the carriage return exists only after decoding |
| `match/base.yml` | plan 2 — two neutral snippets, so an edit to the first has a neighbour to leave alone |
| `match/absent.yml` | plan 3 — a snippet whose file has **no `label` key**, plus a `word: 'true'` |
| `match/refuse.yml` | plan 4 — a `triggers:` list snippet, and a snippet written as a **flow mapping** |

`XDG_CONFIG_HOME` and `HOME` both point into that tree. **The owner's real configuration was never
opened**, and nothing below quotes anything but this run's own synthetic content and this
application's own strings.

`match/cr.yml`, as bytes, before anything was done to it:

```
6d 61 74 63 68 65 73 3a 0a  …  72 65 70 6c 61 63 65 3a 20 22 61 5c 72 62 22 0a  …
                                r  e  p  l  a  c  e  :     "  a  \  r  b  "  \n
```

`5c 72` — a backslash and an `r`. There is no `0d` in the file. That is the shape
`an_escaped_carriage_return_decodes_into_a_projected_logical_value` in
`crates/espansoconfig-core/tests/model_projection.rs` pins, and it is what makes the projected
logical value hold a real carriage return.

### 1.2 What the instrument cost this time

Two things beyond §6.1's, both found the hard way and both worth the next phase's time:

1. **The webview's `localStorage` survives a fresh `HOME`.** The Spanish override set by the
   `cr:es` launch was still in force in the *next* launch, from a different bundle path, with a
   `HOME` that had just been created. `2c-1b-notes.md` §9.1 says `HOME` keys it; on this machine it
   does not — the WebKit data store follows the bundle identifier, which every probe bundle shares.
   The first `paste` launch failed for exactly this reason (it looked for an English control on a
   Spanish screen), and the fix is to set the language **explicitly through the picker** at the top
   of every plan rather than to trust the launch environment. Both failed attempts are counted in
   the eleven launches and neither is reported below as a reading.
2. **A refused-field transcript needs the pane's whole text, not the field's.** The `refuse` plan
   was re-taken once for that reason; §5 is why it mattered.

---

## 2. Plan 1 — the carriage-return case (consult Q7). **PASS**

The question the consult named as *the single most likely defect all the automated tests pass
over*: an untouched `replace: "a\rb"` reaching a real browser control and being submitted with an
LF instead of a CR.

### 2.1 What was drawn

```
open editor: x=658 y=95 w=491 h=580
open head: File match/cr.yml Stop editing
open fields: 6
open f0 Trigger control=input readonly=false disabled=false cr=0 value=":cr"
open f0 Trigger buttons: Take this key out
open f1 Replacement text control=NONE sourceText="acarriage return U+000Db" markers=1[carriage return U+000D]
open f1 Replacement text marker: shown here as the file writes it
open f1 Replacement text kind: This value contains a carriage return, and a text box in this
        window turns every carriage return into a line break. Rather than change a character you
        did not touch, this field is shown and not edited.
open f2 Label control=input readonly=false disabled=false cr=0 value="before"
open f3 Whole word control=input … value=""
open f3 Whole word kind: This key is not in the file. Leaving this box empty writes nothing; typing in it adds the key.
open toolbar: [Undo DISABLED] [Redo DISABLED] [Save this snippet DISABLED]
open panels: 0
open selection: "acarriage return U+000Db"
```

**The implementer's claim is confirmed on screen, exactly as stated.** The `replace` field draws
**no control at all** — `control=NONE`. Its value is drawn through `SourceText`, which names the
character no font draws: one `.invisible` span reading `carriage return U+000D`, between the `a`
and the `b`. The `carriageReturn` refusal sentence is drawn inline beneath it, and the
`browser.detail.valueAsWritten` marker above it. And the value **is selectable**: a `Range` over
the drawn node returns `"acarriage return U+000Db"`, so a person can select and copy it.

`allButtons` for the whole window while the editor is open confirms D10 — the pane's own
`Show this file's text` toggle is the only non-editor control left in the detail column, and the
`replace` field contributes **no** *Take this key out* either, so there is no removal path to that
value any more than there is an edit path.

### 2.2 Editing another field of that snippet, and the bytes

The `label` box was typed into (`before` → `after`), blurred, and *Save this snippet* clicked.

```
typed head: File match/cr.yml Unsaved changes Stop editing
typed toolbar: [Undo] [Redo DISABLED] [Save this snippet]
cr save answered: yes
saved panel0: The file was written. What is on disk now is exactly the text that was sent.
              A copy of this file as it was before this session's first change to it was kept. …
              This snippet has been written. Reading it again is what tells this app how the file
              now spells each value, and which fields it may edit.   [Read this snippet again]
```

**The byte-level verification, which is the actual evidence:**

```
$ cmp -l xdg-before/…/cr.yml  xdg/…/cr.yml
  132 142 141 · 133 145 146 · 134 146 164 · 135 157 145 · 137 145 47 · 138 47 12
```

The **first differing byte is number 132**, which is inside the label's quoted value. Everything
before it — the whole of `replace: "a\rb"`, which occupies bytes 104–118 — is identical. Stated as
a hash rather than as a reading of a hexdump:

```
$ head -c 131 <before>  | shasum -a 256   160ce61c…371db1
$ head -c 131 <after>   | shasum -a 256   160ce61c…371db1
```

And the anchored reconstruction, which is the strongest form: take the before-bytes, replace the
one substring `'before'` with `'after'`, compare with the after-bytes.

```
before 139 bytes, after 138 bytes, expected 138 bytes
RESULT: byte-identical outside the one edited span
```

Finally, `rg -c $'\r'` over the written file finds **nothing**: there is no `0d` byte anywhere in
it, so nothing was converted *into* a carriage return either.

### 2.3 The same reading in Spanish

A second launch, `cr:es`, with the language set through the application's own picker.

```
open editor: x=658 y=95 w=491 h=580          (identical geometry, to the pixel)
open head: Archivo match/cr.yml Dejar de editar
open f1 Texto de sustitución control=NONE sourceText="aretorno de carro U+000Db"
                              markers=1[retorno de carro U+000D]
open f1 Texto de sustitución marker: se muestra aquí tal y como lo escribe el archivo
open f1 Texto de sustitución kind: Este valor contiene un retorno de carro, y una caja de texto de
        esta ventana convierte todos los retornos de carro en saltos de línea. …
open selection: "aretorno de carro U+000Db"
open toolbar: [Deshacer DISABLED] [Rehacer DISABLED] [Guardar este atajo DISABLED]
```

The marker's *name* is translated and its code point is not, which is right. The same anchored
byte check over the Spanish run's file: **byte-identical outside the one edited span**.

### 2.4 What plan 1 establishes, and what it does not

Established, on a screen: a CR-bearing projected value **reaches no control**; it is drawn with the
carriage return named rather than as an invisible line break; it stays selectable; and a save of a
*different* field of the same snippet leaves its bytes untouched to the byte.

**Not established:** that `beginSave`'s third gate fires. There is no path in this window that puts
a carriage return into a `MatchBuffers` — §4 measures why — so the gate that exists because
`MatchBuffers` carries no brand could not be provoked from a window at all. Its evidence stays the
model suite's.

---

## 3. Plan 2 — the ordinary editing round trip. **PASS**

`:round` in `match/base.yml`, `replace` edited from `first value` to `second value`.

```
open   f1 Replacement text control=textarea readonly=false disabled=false cr=0 value="first value"
typed  head: File match/base.yml Unsaved changes Stop editing
typed  toolbar: [Undo] [Redo DISABLED] [Save this snippet]
round save answered: yes
saved  panel0: The file was written. What is on disk now is exactly the text that was sent. …
               [Read this snippet again]
saved  f0..f5 readonly=true, every [Take this key out] DISABLED
saved  toolbar: [Undo DISABLED] [Redo DISABLED] [Save this snippet DISABLED]
```

**The re-seed control is present, and it works.** Clicking *Read this snippet again*:

```
reseeded f0..f5 readonly=false, [Take this key out] enabled again
reseeded toolbar: [Undo DISABLED] [Redo DISABLED] [Save this snippet DISABLED]
reseeded panels: 0
afterReseedEdit f1 Replacement text … value="third value"
afterReseedEdit head: File match/base.yml Unsaved changes Stop editing
afterReseedEdit toolbar: [Undo] [Redo DISABLED] [Save this snippet]
```

So `needsReprojection` really does stop the session accepting changes (every control `readonly`,
every removal disabled, the panel offering the re-seed and **no** *Dismiss*), and the re-seed
really does give editing back. **No dead end results**: the editor came back live and a further
edit re-armed the save control.

**Byte level.** `diff -r` over the whole tree reports exactly one changed file and one new
`.espansoconfig-backups` directory; the anchored reconstruction reports

```
before 245 bytes, after 246 bytes, expected 246 bytes
RESULT: byte-identical outside the one edited span
```

so the comment line, `matches:`, the trigger, the label, the blank line, the second snippet's
comment and the second snippet all came out byte-for-byte unchanged. The backup the panel's second
sentence discloses is real and is `cmp`-identical to the file as it was before the save:
`<scratch>/xdg/espanso/.espansoconfig-backups/2026-08-03T075344Z/match/base.yml`, beside its
`.espansoconfig-batch` marker.

### 3.1 The re-seed this window cannot answer — read, because it is the dead-end risk

A separate launch (`noreseed`) saved, and then **clicked a snippet in a different file** while the
saved panel was still up, which is what makes `reprojectMatch` return `null`.

```
elsewhere panel0: … This snippet has been written. Reading it again is what tells this app how the
                  file now spells each value, and which fields it may edit. This window cannot read
                  this snippet again — it is no longer showing the file the snippet is in. Stop
                  editing, open the file again, and pick the snippet from there.
                  [Read this snippet again DISABLED]
elsewhere allButtons: … [Stop editing] [Take this key out DISABLED] ×3 [Undo DISABLED]
                      [Redo DISABLED] [Save this snippet DISABLED] [Read this snippet again DISABLED]
```

`browser.matchEditor.cannotReproject` — one of this sub-phase's two new strings — **reaches the
screen**, the control is disabled rather than absent, and *Stop editing* stays enabled, so the
disclosed way out is a way out that exists.

---

## 4. Plan 3 — the absent-field rule. **PASS**

`:absent` in `match/absent.yml`, a snippet whose file never had a `label`.

```
open f1 Replacement text control=textarea … value="no label here"
open f2 Label control=input readonly=false disabled=false cr=0 value=""
open f2 Label kind: This key is not in the file. Leaving this box empty writes nothing; typing in
                    it adds the key.
open f2 Label buttons:            ← none: an absent key has nothing to take out
open f3 Whole word control=input … value="true"
```

The absent key says so **in the box that would create it**, as a sentence under the box rather than
as a placeholder inside it. The label box was left blank; `replace` was edited to `edited body`;
saved.

**The file must not gain `label: ''`. It did not.**

```
$ rg -n label <after>/match/absent.yml
1:# Plan 3 — a snippet whose file never had a label.      ← the comment, and nothing else
```

and

```
before 131 bytes, after 129 bytes, expected 129 bytes
RESULT: byte-identical outside the one edited span
```

The two-byte shrink is `'no label here'` → `'edited body'` and nothing else. `word: 'true'` — a
field this application draws as **text**, never as a checkbox (D2u) — came out untouched.

---

## 5. Plan 4 — a refused field, and an error string on screen. **PASS, with one finding**

### 5.1 The read-only field

`:r1` in `match/refuse.yml` fires from a `triggers:` list, which is the `triggerNotSingle`
eligibility refusal.

```
open f0 Trigger control=NONE sourceText=ABSENT markers=0[]
open f0 Trigger kind: This snippet does not fire from one literal trigger, so its trigger is shown
        and not edited here. Changing a snippet from one trigger form to another is not something
        this app does.
open f0 Trigger buttons:              ← none
open f1 Replacement text control=textarea readonly=false … value="two triggers"
open f2 Label control=input readonly=false … value="refused trigger"
```

The refusal is **read-only rather than disabled** in the strong sense the consult's Q5 asked for:
there is no `<input disabled>` anywhere, the reason is drawn inline, and the surrounding fields stay
fully editable. For the one refusal that has a value to show — the carriage return of plan 1 — the
value is drawn and selectable (§2.1).

**Finding — a refused trigger shows its reason and not its value.** `sourceText=ABSENT`: the field
draws its name and its refusal sentence and nothing between them. That is correct in the model —
`projectedScalar` has no single scalar for a `triggers:` list, so `field.text` is `''` and
`{#if field.text !== ''}` is false — but on screen it means **a person editing a multi-trigger
snippet cannot see what its triggers are**, because D10 replaces the whole detail pane with the
editor while it is open. Measured, not guessed:

```
open detailText: "Show this file’s text File match/refuse.yml Stop editing Trigger This snippet
                  does not fire from one literal trigger … Replacement text Take this key out
                  Label Take this key out Word boundary Whole word … Undo Redo Save this snippet"
open triggersOnScreen: no
open f0 innerHTML: "<p class=\"name\">Trigger</p> <!----> <p class=\"kind\">This snippet does not
                    fire from one literal trigger …</p><!---->"
```

Neither `:r1` nor `:r2` appears anywhere in the pane. This is presentational, not a data-integrity
defect — nothing is written, and the snippet list behind still carries the trigger — but it is a
real thing a screen does that no model test calls wrong. The same silence applies to the other two
value-less refusals (`ownsNoBytes`, `unmodelledShape`), where "there is no value" is a fairer
description.

### 5.2 An error string reaching the screen

`:flow` in the same file is written as a flow mapping, `- {trigger: ':flow', replace: 'flow value'}`.
A `label` was typed into it — an **insertion**, which the patch engine refuses by name for a flow
collection — and saved.

```
patcherr save answered: yes
failed head: File match/refuse.yml Unsaved changes Stop editing
failed panel0: The save could not be sent, so nothing was written. What you typed is still here.
               What this app was told:
               espansoConfig could not carry this save through. What it reports beside this is the
               reason.
               The change could not be applied to the file’s text, so the file was left as it was.
               This entry sits inside an inline list or map, which has no line of its own to add or
               delete.
failed f2 Label control=input … value="added label"
failed toolbar: [Undo] [Redo DISABLED] [Save this snippet]
```

**The whole `failureLines` chain is drawn, in order**: the `IpcFailure`, then
`code.saveError.patch`, then `code.editError.flowCollection`. So at least one of the newly-wired
error strings reaches the screen as a **sentence**, not blank and not as a raw key. The draft
survived the failure and the save control came back.

`diff -r` over the whole tree after that launch: **no output at all** — not even a backup
directory. A refused save wrote nothing.

**What was not seen: a `code.draftError.*` string.** The refusal that arrived came from the patch
engine, not from the planner. The most obvious planner-side provocation is unreachable from this
screen by construction: a duplicate mapping key is a `HazardKind::DuplicateMappingKey`, which makes
the whole match not safely editable, so the *Edit this snippet* control is withdrawn and
`AmbiguousKey` can never be drafted from a window. `code.draftError.*` therefore has model-suite
evidence only, and this reading does not claim otherwise.

---

## 6. The extra measurement: what a WKWebView control does with a carriage return

2c-1b's central finding was that a `<textarea>`'s value is the HTML **API value**, with every line
break normalised to LF, and that jsdom's normalisation is not WebKit's. This sub-phase's fields go
through both a `<textarea>` and five `<input>`s, so the same question was put to a real window
directly (plan `paste`, which assigns the value a paste would produce and then reads it back):

```
textarea assigned:      "x\ry\r\nz"
textarea reads back:    "x\ny\nz"
model gave back:        "x\ny\nz"

input assigned:         "p\rq"
input reads back:       "pq"
model gave back (label):"pq"
```

Two facts, both measured rather than assumed:

- a `<textarea>` turns a bare CR **and** a CRLF into a single LF — WebKit does what the spec says
  and what 2c-1b found;
- an `<input type="text">` **deletes** the carriage return rather than converting it. `p\rq`
  becomes `pq`, two characters, not three.

Together with §2 this is the complete answer to Q7 as far as a window can give one: **no control in
this editor can produce a carriage return**, and the one value that already contains one is drawn
through a control-free surface. The save that followed wrote a block scalar and disclosed the style
change it had to make:

```
outcome: The file was written. … What this save had to change in the way the file is written:
         espansoConfig had to write this value in a different style from the one the file used, so
         its spelling changed as well as its content. …
```

which is a `PresentationNote` on a screen for the first time. The written file holds no `0d` byte.

**The hole this opens, stated as a hole:** a person who pastes CRLF text into the replacement box
gets LF written. That is a change to a value they are editing, not to bytes they never touched, so
it does not break the preservation promise — but this application currently **cannot** write a
carriage return into a value at all, and nothing on screen says so at the moment of typing.

---

## 7. What this evidence is, and what it is not

**Is:** what WebKit actually laid out and rendered in the real application's webview, plus what
`cmp`/`diff`/an anchored reconstruction say about the bytes on disk on each side of a save.

**Is not:**

1. **Pixels.** The probe reads the DOM. It cannot see a pane painted white-on-white, a `z-index`
   accident or a font that failed to load. Unchanged from 1c-1 §10.3, and still a hole.
2. **Pointer hit-testing.** `HTMLElement.click()` takes the same path into `onclick` a user's click
   takes; which element *receives* a click is a pixel question this cannot answer.
3. **Real keystrokes.** A value assignment plus a bubbling `input` event is the component's path,
   not the input method's. Composition, autocorrect and IME behaviour are untested.
4. **`beginSave`'s carriage-return gate** (§2.4) and **`code.draftError.*`** (§5.2) — neither is
   reachable from this window, and both keep model-suite evidence only.
5. **Every eligibility refusal.** Two of the five were seen on screen (`carriageReturn`,
   `triggerNotSingle`). `notDecodable`, `ownsNoBytes` and `unmodelledShape` were not provoked.
6. **A conflict, a `refused` verdict, an identity-stale save, an in-flight guard.** None of the
   three outcome arms other than `saved`, and neither `sendFailure` arm other than the ordinary
   one, was provoked beyond §5.2's. The conflict arm in particular draws three revision sentences
   and a *Keep editing* control that nothing here exercised.
7. **The real configuration.** Never opened, deliberately (§1.1).

---

## 8. Verdict

| Plan | Verdict |
|---|---|
| 1 — the carriage-return case (consult Q7) | **PASS** — no control drawn, marker + refusal + selectable value on screen, `replace` bytes identical across a save of another field, in both languages |
| 2 — the ordinary round trip | **PASS** — success reported, byte-identical outside the edited span, backup real, re-seed present and working, no dead end |
| 3 — the absent-field rule | **PASS** — no `label: ''` written, byte-identical outside the edited span |
| 4 — a refused field and an error string | **PASS**, with one finding: refused fields are read-only rather than disabled and their reason is inline, and `code.saveError.patch` + `code.editError.flowCollection` reach the screen as sentences. The finding is §5.1 — a refused *trigger* shows no value at all, and the pane behind the editor is not there to show it either |

**One defect found, and it is presentational**: §5.1. Reproduction — put a snippet with a
`triggers:` list in a match file, select it, click *Edit this snippet*: the Trigger field shows its
name and the `triggerNotSingle` sentence, and the triggers themselves appear nowhere in the pane.

## 9. The probe, and its removal

**Twice, once per run.** `src/probe.ts` was deleted; `src/main.ts` and `src-tauri/src/main.rs` were
restored from copies taken **before** the probe existed and compared with `diff`:
`main.ts IDENTICAL`, `main.rs IDENTICAL`, both times. `dist/` was rebuilt from the reverted source
and came back to **158 modules** and to the same asset hash as the pre-probe build
(`index-DY6UpPzV.js`), with no `svelte/internal/server` and no `node:async_hooks` in the bundle.

**158 is the expected count, and its shape is what makes it so**: the guard stood at 156 after
2c-2-1, when `src/lib/browser/matchEditor.ts` had no importer and was tree-shaken out. 2c-2-2 adds
`MatchEditor.svelte` **and** pulls `matchEditor.ts` into the graph behind it — two source modules,
`+2`. That is the "moved by exactly the number of new source modules" shape, not the jump to ~180
that means the `resolve.conditions` regression.

`git status --short --untracked-files=all` shows neither probe file modified and no probe artefact
anywhere in the tree; every scratch path lived outside the repository.

Re-run afterwards, all passing: `npm run check` (394 files, 0 errors, 0 warnings), `npm test`
(38 files, 1007 tests), `npm run build`, `cargo test --workspace` (23 test binaries, all ok),
`cargo clippy --workspace --all-targets -- -D warnings`, `cargo fmt --check`.

---
---

# Phase 2c-2-2 — the window reading, **re-taken**

**The first reading, above, is left exactly as it was written. This is the second, and both are the
record.** The rule that forced it is CLAUDE.md's: *a window reading is re-taken after any change to a
component*, and `MatchEditor.svelte` changed after §5.1's finding was fixed.

What changed under it: `FieldBaseline` gained `shown: readonly ShownValue[]`, computed by
`shownValuesOf` and surfaced on `EditableFieldModel`; the component walks `field.shown` instead of
drawing a single `field.text`. So **plan 1 of the first reading is invalidated** — the
carriage-return field's own markup is on the new path — and the finding of §5.1 has a fix that only a
screen can confirm.

**Nothing here was inferred from the test suite.** Same instrument, same rules.

## 11. The setup, unchanged

Same technique as §1: `src/probe.ts`, a `probe_plan` command reading `ECFG_PROBE_PLAN`, a
`render_probe` command printing the transcript to stdout, a `setTimeout` 700 ms after mount, one plan
per launch into a fresh bundle path over a freshly rebuilt configuration.

**Seven launches**, `<scratch>/L1` … `<scratch>/L7`, each with its own `espansoConfig.app`, its own
`XDG_CONFIG_HOME` and its own `HOME`. **Every launch reached its own `--- end` and every `probe.err`
was zero bytes**, so no transcript below is a partial run rounded up to a conclusion. §1.2's first
lesson was applied rather than re-learned: **every plan sets the language explicitly through the
picker**, and no launch was lost to a leaked override this time.

Two measurements were added to the instrument, because "it was in the DOM" is weaker than this
reading needs:

- **the editor's bounding rectangle**, and
- **each drawn value box's own rectangle**, so a value that is in the DOM at zero height is not
  reported as a value that was drawn.

### 11.1 The configuration

**Synthetic, hand-written for this run, in a scratch directory outside the repository**, rebuilt from
scratch before every launch. **The owner's real configuration was never opened.** Five files:

| File | What it is for |
|---|---|
| `config/default.yml` | a profile, so the sidebar has one |
| `match/triggers.yml` | plan A — five snippets, one per trigger shape |
| `match/cr.yml` | plan B — `replace: "a\rb"` written with a **two-character escape**, so the file holds no `0d` byte and the carriage return exists only after decoding |
| `match/absent.yml` | plan C — a snippet whose file has **no `label` key**, plus a `word: 'true'` |
| `match/base.yml` | plan C — two neighbouring snippets, so an edit to the first has one to leave alone |

`match/cr.yml` as bytes, before anything was done to it — 68 bytes, and `61 5c 72 62` is `a`,
backslash, `r`, `b`:

```
00000020: 7265 706c 6163 653a 2022 615c 7262 220a  replace: "a\rb".
```

## 12. Plan A — the fixed defect, on a screen. **PASS**

`match/triggers.yml`, four snippets in one launch (L1, re-taken as L2 with geometry), then a fifth in
L7. This is the exact case §5.1 measured as `open triggersOnScreen: no`.

### 12.1 A `triggers:` list — every trigger, drawn

```
list editor: x=658 y=95 w=491 h=580
list f0 Trigger control=NONE
list f0 Trigger child0 p.name        "Trigger"
list f0 Trigger child1 span.marker   "shown here as the file writes it"
list f0 Trigger child2 div.sourceText value=":ta" markers=0[] box=658,190,491x30 selection=":ta"
list f0 Trigger child3 div.sourceText value=":tb" markers=0[] box=658,223,491x30 selection=":tb"
list f0 Trigger child4 div.sourceText value="tc"  markers=0[] box=658,257,491x30 selection="tc"
list f0 Trigger child5 p.kind        "This snippet does not fire from one literal trigger, so its
                                      trigger is shown and not edited here. …"
list f0 Trigger buttons:                        ← none
list disabledInputs: 0
```

**The defect is fixed, and the fix is visible rather than merely present.** All three triggers of the
list are drawn, in the order the file writes them, each in its own `SourceText` box — and the boxes
have **real geometry at three distinct heights** (y = 190, 223, 257, each 491×30), so they are three
stacked bordered boxes on a screen, not three nodes collapsed on top of each other.

`control=NONE` and `disabledInputs: 0` together are the strong form of the consult's Q5: the field is
**read-only, not disabled** — there is no `<input disabled>` anywhere in the editor. Each box selects
independently (`selection=":ta"`), and selecting the whole field yields
`"Trigger\n\nshown here as the file writes it\n:ta\n:tb\ntc\nThis snippet does not fire…"`, so a
person can select and copy their triggers. The `triggerNotSingle` sentence is drawn inline beneath
them, and the surrounding five fields stay fully editable (`f1 Replacement text control=textarea
readonly=false`).

### 12.2 A `regex:`, a `Several`, and a list item that is not a scalar

```
regex     f0 Trigger child2 div.sourceText value="he(l+)o"   box=658,190,491x30 selection="he(l+)o"
several   f0 Trigger child2 div.sourceText value=":sev"      box=658,190,491x30
several   f0 Trigger child3 div.sourceText value="sev[0-9]+" box=658,223,491x30
notScalar f0 Trigger child2 div.sourceText value=":ns"       box=658,190,491x30
notScalar f0 Trigger child3 span.marker   "a list"
```

All three further forms draw. The `Several` — a snippet holding **both** a `trigger:` and a `regex:` —
contributes both. And a `triggers:` item that is **not a scalar** is **named** rather than dropped:
`a list`, through `tValueKind`, in the marker face rather than the document face, so it cannot be
mistaken for the file's own text.

`diff -r` over the whole tree after L2: **no output at all**. Plan A wrote nothing.

### 12.3 The same reading in Spanish (L4)

```
crEs f1 Texto de sustitución child2 div.sourceText value="aretorno de carro U+000Db"
                                    markers=1[retorno de carro U+000D] box=658,268,491x30
nsEs f0 Disparador          child3 span.marker "una lista"
nsEs f0 Disparador          child4 p.kind "Este atajo no se dispara con un único disparador literal…"
```

Identical geometry to the pixel. The marker's **name** is translated and its code point is not; the
new `tValueKind` path is translated too (`a list` → `una lista`).

## 13. Plan B — the carriage-return case (consult Q7), re-taken. **PASS**

L3. The field's component code is new, so this is a fresh reading, not a citation of §2.

```
open editor: x=658 y=95 w=491 h=580
open f1 Replacement text control=NONE
open f1 Replacement text child1 span.marker   "shown here as the file writes it"
open f1 Replacement text child2 div.sourceText value="acarriage return U+000Db"
                                markers=1[carriage return U+000D] box=658,268,491x30
                                selection="acarriage return U+000Db"
open f1 Replacement text child3 p.kind "This value contains a carriage return, and a text box in this
                                        window turns every carriage return into a line break. …"
open f1 Replacement text buttons:               ← none, so no removal path either
open disabledInputs: 0
open allButtons: … [Show this file's text] [Stop editing] [Take this key out] ×2
                  [Undo DISABLED] [Redo DISABLED] [Save this snippet DISABLED]
```

**Everything §2.1 established still holds on the new path.** No control at all; one `.invisible` span
reading `carriage return U+000D` between the `a` and the `b`; the `carriageReturn` refusal inline; the
`valueAsWritten` marker above; the value selectable; a box with real geometry (491×30). `allButtons`
confirms D10 is unchanged — the pane's own text toggle is the only non-editor control left in the
detail column.

### 13.1 Editing another field of that snippet, and the bytes

The `label` box was typed into (`before` → `after`), blurred, and *Save this snippet* clicked.

```
typed head:    File match/cr.yml Unsaved changes Stop editing
typed toolbar: [Undo] [Redo DISABLED] [Save this snippet]
cr save answered: yes
saved panel0:  The file was written. What is on disk now is exactly the text that was sent. A copy of
               this file as it was before this session's first change to it was kept. … This snippet
               has been written. Reading it again is what tells this app how the file now spells each
               value, and which fields it may edit.   [Read this snippet again]
saved f1 Replacement text child2 div.sourceText value="acarriage return U+000Db" markers=1[…]
```

**The byte-level verification, which is the actual evidence.**

```
$ cmp -l <before> <after>
  61 142 141 · 62 145 146 · 63 146 164 · 64 157 145 · 66 145 42 · 67 42 12
```

The **first differing byte is number 61**, inside the label's quoted value. `replace: "a\rb"` occupies
1-based bytes 33–47; the whole of it, and the newline after it, is before the first difference. As a
hash rather than as a reading of a hexdump:

```
$ head -c 60 <before> | shasum -a 256   a64ed0f5…b7f99d
$ head -c 60 <after>  | shasum -a 256   a64ed0f5…b7f99d
```

And the anchored reconstruction, which is the strongest form:

```
anchor 'before' occurs 1 time(s) in the before-bytes
before 68 bytes, after 67 bytes, expected 67 bytes
RESULT: byte-identical outside the one edited span
carriage returns in after: 0
```

So nothing was converted **into** a carriage return either. `diff -r` over the whole tree reports
exactly one changed file plus one new `.espansoconfig-backups` directory, and the backup the panel's
second sentence discloses is real and `cmp`-identical to the file as it was before the save.

**Not established, unchanged from §2.4:** `beginSave`'s third gate. No path in this window puts a
carriage return into a `MatchBuffers`, so its evidence stays the model suite's.

## 14. Plan C — the regression sweep. **PASS**

### 14.1 The absent-field rule (L5)

```
open f2 Label      control=input readonly=false disabled=false cr=0 value=""
open f2 Label kind: This key is not in the file. Leaving this box empty writes nothing; typing in it
                    adds the key.
open f2 Label buttons:               ← none: an absent key has nothing to take out
open f3 Whole word control=input … value="true"
```

The label box was left blank, `replace` was edited, and the snippet saved. **The file must not gain
`label: ''`. It did not.**

```
$ rg -n label <after>/match/absent.yml
1:# Plan C — a snippet whose file never had a label.     ← the comment, and nothing else

anchor 'no label here' occurs 1 time(s) in the before-bytes
before 131 bytes, after 129 bytes, expected 129 bytes
RESULT: byte-identical outside the one edited span
```

`word: 'true'` — drawn as **text**, never as a checkbox (D2u) — came out untouched.

### 14.2 The re-seed control, and no dead end (L6)

`:round` in `match/base.yml`, `replace` edited from `first value` to `second value`, saved.

```
saved    f0..f5 readonly=true, every [Take this key out] DISABLED
saved    toolbar: [Read this snippet again]        ← and no [Dismiss]
reload clicked: yes
reseeded f0 Trigger          control=input readonly=false … value=":round"
reseeded f1 Replacement text control=textarea readonly=false … value="second value"
reseeded f0 Trigger buttons: [Take this key out]   ← enabled again
reseeded toolbar: [Undo DISABLED] [Redo DISABLED] [Save this snippet DISABLED]
reseeded panels: 0
afterReseedEdit head:    File match/base.yml Unsaved changes Stop editing
afterReseedEdit toolbar: [Undo] [Redo DISABLED] [Save this snippet]
```

`needsReprojection` really does stop the session accepting changes, the re-seed really does give
editing back, and **no dead end results**: a further edit re-armed the save control. Byte level:

```
anchor 'first value' occurs 1 time(s) in the before-bytes
before 221 bytes, after 222 bytes, expected 222 bytes
RESULT: byte-identical outside the one edited span
```

so the comment lines, `matches:`, the trigger, the label, the blank line and the whole second snippet
came out byte-for-byte unchanged.

## 15. Two findings, both new, both measured

### 15.1 **"In source order" is a claim the code does not give.** L7

`shownValuesOf`'s `@returns` in `src/lib/browser/matchEditor.ts:703` says *"What to draw, in source
order"*, and `FieldBaseline.shown`'s own doc at line 400 says the same. **It is not source order for
the three trigger *forms*.** `shownValuesOf` reads `TriggerSpec`, which is a projection with three
named slots, and pushes them in the fixed order `trigger` → `triggers` → `regex`. The file's order of
those keys is not preserved.

Measured, in a fifth snippet written with `regex:` **before** `trigger:`:

```
  - regex: "rev[0-9]+"
    trigger: ":rev"
    replace: "reversed body"
```

```
order f0 Trigger child2 div.sourceText value=":rev"      box=658,190,491x30
order f0 Trigger child3 div.sourceText value="rev[0-9]+" box=658,223,491x30
```

The screen draws the trigger first, though the file writes the regex first. **What *is* in source
order is the items of a `triggers:` sequence** — those come from a projected sequence and keep their
order, which §12.1 confirms.

This is **this project's named worst defect class**: a decision record — here a doc comment — claiming
a guarantee the code does not give. Nothing is written and no byte is at risk; the defect is that a
later reader who trusts the sentence will believe the editor shows the file's own ordering. Either the
two doc sites should say *"in the projection's order: `trigger`, then every item of `triggers:`, then
`regex:`; the items of `triggers:` are in source order"*, or `shownValuesOf` should sort by span.

**Reproduction:** put a snippet in a match file that writes `regex:` on the line above `trigger:`,
select it, click *Edit this snippet*. The Trigger field draws the literal trigger above the regular
expression, which is the reverse of the file.

### 15.2 **The shown list does not say which trigger form each value came from.** Presentational

Every box under *Trigger* is drawn identically. For the `Several` snippet a person sees

```
several f0 Trigger child2 div.sourceText value=":sev"
several f0 Trigger child3 div.sourceText value="sev[0-9]+"
```

— two unlabelled boxes — and **cannot tell the literal trigger from the regular expression**. The same
silence covers a `triggers:` list: its three boxes carry no marker saying they are items of one
sequence rather than three separate keys, where `DetailPane.svelte` draws a `•` bullet for exactly
that reason (its `.bullet` rule, and the comment above it).

The detail pane behind the editor **does** label them, as three separate rows — but D10 replaces the
whole detail pane while the editor is open, which is the same structural reason §5.1's finding
mattered. This is strictly smaller than §5.1 (the values are now on screen, correct, and selectable)
and it is not a data-integrity defect: nothing is written from a refused field.

**Reproduction:** put a snippet holding both `trigger: ":sev"` and `regex: "sev[0-9]+"` in a match
file, select it, click *Edit this snippet*: the Trigger field draws `:sev` and `sev[0-9]+` in two
identical boxes with nothing distinguishing them.

## 16. What this evidence is, and what it is not

**Is:** what WebKit actually laid out and rendered in the real application's webview — including each
value box's own rectangle — plus what `cmp`, `diff` and an anchored reconstruction say about the bytes
on disk on each side of a save.

**Is not**, and §7's list carries over unchanged except where noted:

1. **Pixels.** The probe reads the DOM and now also reads layout geometry, which rules out a
   zero-height box but not a white-on-white one, a `z-index` accident or a font that failed to load.
2. **Pointer hit-testing** and **real keystrokes** — unchanged from §7.2 and §7.3.
3. **`beginSave`'s carriage-return gate** and **`code.draftError.*`** — unchanged from §7.4.
4. **Every eligibility refusal.** Three of the five were seen on screen this time
   (`carriageReturn`, `triggerNotSingle` — in all four of its shapes — and, through §12.2, a
   non-scalar list item). `notDecodable`, `ownsNoBytes` and `unmodelledShape` were **not** provoked,
   so the two arms of `shownValuesOf` that serve them have **model-suite evidence only**. That is a
   named hole in the very function this reading exists to check.
5. **A conflict, a `refused` verdict, an identity-stale save, an in-flight guard** — unchanged from
   §7.6. §5.2's error-string reading was not re-taken; that markup did not change.
6. **The real configuration.** Never opened, deliberately.

## 17. Verdict

| Plan | Verdict |
|---|---|
| A — the fixed defect | **PASS** — all four trigger shapes draw, each in its own box with real geometry, read-only rather than disabled, individually selectable, with the refusal inline; a non-scalar item is named, not dropped; both languages |
| B — the carriage return, re-taken | **PASS** — no control drawn, marker + refusal + selectable value on the new `field.shown` path, `replace` bytes identical across a save of another field, first differing byte 61 of 68 |
| C — the regression sweep | **PASS** — no `label: ''` written and byte-identical outside the edited span; the re-seed clears `needsReprojection`, re-arms editing and leaves no dead end |

**§5.1 is fixed and the fix is confirmed on a screen.** Two new findings, §15.1 and §15.2; neither
writes anything, and §15.1 is a doc-versus-code discrepancy rather than a behaviour defect.

## 18. The probe, and its removal

`src/probe.ts` was deleted; `src/main.ts` and `src-tauri/src/main.rs` were restored from copies taken
**before** the probe existed and compared with `diff`: **`main.ts IDENTICAL`, `main.rs IDENTICAL`**.
`git status --short --untracked-files=all` afterwards is byte-for-byte the status this reading
started from — no probe file, no probe artefact, and every scratch path lived outside the repository.

`dist/` was rebuilt from the reverted source and came back to **158 modules**, the count §9 recorded,
with **no `svelte/internal/server` and no `node:async_hooks`** in the bundle. During the reading the
count was 159 — 158 plus `probe.ts`, which is the "moved by exactly the number of new source modules"
shape rather than the jump to ~180 that means the `resolve.conditions` regression.

Re-run afterwards, all passing and all unchanged from the pre-reading figures:

```
npm test            38 files, 1014 tests
npm run check       394 files, 0 errors, 0 warnings
npm run build       158 modules
cargo test --workspace   1008 tests, 0 failed
```

---
---

# Phase 2c-2-2 — the window reading, **third pass (targeted)**

**Both earlier readings above are left exactly as they were written.** This is the third, taken
because §15.1 and §15.2 were both fixed as real code changes and the component changed again.

**Targeted, not a sweep.** Plans A, B and C all passed on the previous component and nothing in this
change touches what is written, so this reading drives only the ordering and the labelling of a
refused field's shown values, plus a cheap non-regression over the two subjects that share the code
path. **No byte-level check was taken this round** and none was needed: no launch below saved
anything, and `diff -r` was not required because no plan clicked a save control.

**Three launches**, `<scratch>/L8`, `L9`, `L10`, each a fresh bundle path over a freshly rebuilt
configuration, each with its own `XDG_CONFIG_HOME` and `HOME`, each setting its language explicitly
through the picker. **All three reached `--- end` and all three `probe.err` were zero bytes.**
Synthetic fixtures only; the owner's real configuration was never opened.

The probe's walk had to change with the markup: each shown value is now a `div.shownValue` wrapping
an optional `span.marker` name and then the value, so the walk descends one level. It reports each
name's **own rectangle** as well as the value's, because a name in the DOM at zero size is not a name
a person can read.

### 19.1 The fixture

One new file, `match/order.yml`, four snippets, all read-only on screen:

| # | Written as | What it tests |
|---|---|---|
| 1 | `regex:` then `trigger:` | the §15.1 repro exactly |
| 2 | `trigger:` then `regex:`, same two values | the opposite file order |
| 3 | `regex:`, `triggers:`, `trigger:` | three forms ordered against one another |
| 4 | a `triggers:` list of a nested sequence and a nested mapping, then `regex:` | the unlocatable-form fallback |

## 20. Item 1 — the screen follows the file, both ways. **PASS**

L8. **Same two values, opposite file order, opposite screen order.**

```
regexFirst   f0 Trigger v0 label="Regular expression" labelBox=658,190,491x14
                          value="rev[0-9]+" valueBox=658,206,491x30 selection="rev[0-9]+"
regexFirst   f0 Trigger v1 label="Trigger"            labelBox=658,239,491x14
                          value=":rev"     valueBox=658,256,491x30 selection=":rev"

triggerFirst f0 Trigger v0 label="Trigger"            labelBox=658,190,491x14
                          value=":sev"     valueBox=658,206,491x30 selection=":sev"
triggerFirst f0 Trigger v1 label="Regular expression" labelBox=658,239,491x14
                          value="sev[0-9]+" valueBox=658,256,491x30 selection="sev[0-9]+"
```

The §15.1 repro — the file writing `regex:` on the line **above** `trigger:` — previously drew `:rev`
first. **It now draws the regular expression first.** And the second snippet, holding the same two
kinds of value written the other way round, draws them the other way round. That pair is the actual
claim: the screen follows the file, rather than a fixed slot order that happened to agree with one of
the two files.

Three forms at once, written `regex:`, `triggers:`, `trigger:`:

```
threeForms f0 Trigger v0 label="Regular expression" value="mid[0-9]+" valueBox=658,206,491x30
threeForms f0 Trigger v1 label="Triggers"           value=":m1"      valueBox=658,256,491x30
threeForms f0 Trigger v2 label="Triggers"           value=":m2"      valueBox=658,305,491x30
threeForms f0 Trigger v3 label="Trigger"            value=":mid"     valueBox=658,355,491x30
```

The three forms come out in the file's order **and** the two items inside the `triggers:` list keep
their own list order within it — the one place the phrase "source order" still applies, and it holds.

## 21. Item 2 — the labels are on screen, named and distinguishable. **PASS**

The `label=` and `labelBox=` fields above are the evidence. In the `Several` of §20 the two boxes
carry **`"Trigger"` and `"Regular expression"`** — different visible text, each **14 px tall and
491 px wide**, so they are drawn text rather than empty nodes, and each sits directly above the value
it names (`Trigger` above `:sev`, `Regular expression` above `sev[0-9]+`). They are the detail pane's
own strings through `tDetailField`, not raw keys: nothing on screen reads `trigger` or
`browser.detail.field.regex`.

**A second language, L9**, because these strings are reused from another pane:

```
regexFirst   f0 Disparador v0 label="Expresión regular" value="rev[0-9]+"
regexFirst   f0 Disparador v1 label="Disparador"        value=":rev"
threeForms   f0 Disparador v1 label="Disparadores"      value=":m1"
unlocated    f0 Disparador v1 label="Disparadores"      notScalar="un conjunto de claves"
```

All three names translate, the ordering is identical to the English run, and the geometry is
identical to the pixel.

**Two cosmetic observations, neither a defect.** The field's own heading and one value's name are the
same word (`Trigger` above a box named `Trigger`; `Disparador` above `Disparador`), and every item of
a `triggers:` list repeats the name `Triggers`. Both are honest — the values really do come from
those keys — and both are strictly better than §15.2's two identical unlabelled boxes.

## 22. Item 3 — the cheap non-regression. **PASS**

L10.

```
list f0 Trigger control=NONE children=p.name span.marker div.shownValue ×3 p.kind
list f0 Trigger v0 label="Triggers" value=":ta" valueBox=658,206,491x30 selection=":ta"
list f0 Trigger v1 label="Triggers" value=":tb" valueBox=658,256,491x30 selection=":tb"
list f0 Trigger v2 label="Triggers" value="tc"  valueBox=658,305,491x30 selection="tc"
list disabledInputs: 0
list f1 Replacement text control=textarea readonly=false … value="list body"

cr f1 Replacement text control=NONE
cr f1 Replacement text v0 label="NONE" labelBox=n/a value="acarriage return U+000Db"
                          valueBox=658,268,491x30 markers=1[carriage return U+000D]
                          selection="acarriage return U+000Db"
cr f1 Replacement text kind: This value contains a carriage return, …
cr disabledInputs: 0
```

A `triggers:` list still draws **every** item, in list order, read-only rather than disabled
(`control=NONE`, `disabledInputs: 0`), each selectable and each with its own rectangle. The
carriage-return field still draws no control, still names the character no font draws, still shows the
`carriageReturn` refusal, still selects — and correctly carries **no** source name (`label="NONE"`),
because its own heading already says *Replacement text*. Nothing looked wrong, so no byte check was
escalated to.

## 23. The fallback could not be reached, and the reason is a finding

**The one thing this reading was asked to try if it was cheap, and it did not work.** The fourth
snippet is exactly the shape the model names — a `triggers:` list *every* item of which is a nested
sequence or mapping — written **above** a `regex:`. If the form were unlocatable it would have been
drawn **after** the regex. It was not:

```
unlocated f0 Trigger v0 label="Triggers"           notScalar="a list"         box=658,190,491x31
unlocated f0 Trigger v1 label="Triggers"           notScalar="a set of keys"  box=658,224,491x31
unlocated f0 Trigger v2 label="Regular expression" value="un[0-9]+"           valueBox=658,274,491x30
```

The `triggers:` form was drawn **first — in the file's order**, so the projection located it.

**Finding: `shownValuesOf`'s doc names a construction that cannot produce the case it claims.** The
comment reads *"a form the projection gives **no** byte position for is drawn after every positioned
one… **Exactly one shape produces that**: a `triggers:` list *every* item of which is a nested
sequence or mapping, because those two arms of `ValueView` carry no span."* The shape above is that
shape, and it produced a located form.

The reason is `scalar_sequence()` in
`crates/espansoconfig-core/src/model/project.rs:143`, which is the only projector that ever fills
`TriggerSpec::triggers`: a non-scalar item is not passed through as `ValueView::Sequence` or
`ValueView::Mapping` at all — it is turned into **`ValueView::Elided { kind, span, node }` carrying
the item's own span**. So every possible item of a `triggers:` list is a `Scalar` or an `Elided`, and
`spanStartOf` returns a position for both. `TriggerSpec::trigger` and `::regex` are `ScalarView` and
always carry one. **`position: null` is therefore unreachable through `shownValuesOf`, and
`orderedForms`' unplaced partition is dead code as far as this caller can drive it.**

The screen's *behaviour* is right — the shape drew in the file's order, which is what a reader wants —
and `shapeOf` reading `Elided.kind` is why the two items were still correctly named `a list` and
`a set of keys`. What is wrong is the sentence: it presents a live fallback with a named trigger, and
this is **the same defect class as §15.1** — a record claiming something the code does not do — one
level further in. The honest wording is that the partition is defensive: no shape `TriggerSpec` can
carry reaches it, and the guard exists so that a future widening of what `triggers:` may hold cannot
silently invent a position.

**Reproduction:** put a snippet in a match file whose `triggers:` list holds only `[a, b]` and
`{k: v}`, written on the lines **above** a `regex:`, select it, click *Edit this snippet*. The two
list items are drawn first — the file's order — not after the regex as the comment says they would
be.

## 24. Verdict

| Item | Verdict |
|---|---|
| 1 — the §15.1 repro follows the file, both ways | **PASS** — regex-above-trigger draws the regex first; the same two values written the other way draw the other way; three forms order correctly and a list's items keep their own order |
| 2 — the §15.2 labels | **PASS** — different visible names, each 491×14 of real drawn text above the right value, through `tDetailField` and never a raw key; confirmed in Spanish too |
| 3 — non-regression | **PASS** — a `triggers:` list still draws every item in list order, read-only not disabled, selectable; the CR field unchanged and correctly unnamed |
| bonus — the unlocatable-form fallback | **NOT REACHABLE**, and that is §23's finding rather than a skip |

**§15.1 and §15.2 are both fixed and both fixes are confirmed on a screen.** One new finding, §23,
which is documentation-versus-code and writes nothing.

**What this evidence is not**, carrying over §16 unchanged: pixels beyond layout geometry, pointer
hit-testing, real keystrokes, `beginSave`'s carriage-return gate, `code.draftError.*`, the
`notDecodable` and `ownsNoBytes` refusals, the conflict and refused outcome arms, and the real
configuration.

## 25. The probe, and its removal

**Third time.** `src/probe.ts` was deleted; `src/main.ts` and `src-tauri/src/main.rs` were restored
from the copies taken before the probe first existed and compared with `diff`: **`main.ts IDENTICAL`,
`main.rs IDENTICAL`**. `git status --short --untracked-files=all` afterwards is byte-for-byte the
status this pass started from; every scratch path lived outside the repository.

`dist/` was rebuilt from the reverted source: **158 modules**, with no `svelte/internal/server` and no
`node:async_hooks` in the bundle. Re-run afterwards, all passing:

```
npm test            38 files, 1017 tests
npm run check       394 files, 0 errors, 0 warnings
npm run build       158 modules
cargo test --workspace   1008 tests, 0 failed
```

---
---

# Phase 2c-2-2 — the window reading, **fourth pass (captions and one refusal)**

**The three earlier readings above are untouched.** This is the fourth, taken because Codex's
confirmation pass found three more instances of the caption/string-over-claims class, a self-audit
found two more, and all five were fixed — so the component changed again.

**The narrowest pass yet**, and deliberately so: nothing already established was re-driven. Four
subjects only — the two per-arm captions, the reworded `unmodelledShape` refusal, the typed
reprojection reason, and the `fieldRemoved` marker's gate.

**Five launches**, `<scratch>/L11` … `<scratch>/L15`, one plan each into a fresh bundle path over a
freshly rebuilt configuration, each setting its language explicitly through the picker. **All five
reached `--- end` and all five `probe.err` were zero bytes.** Two new synthetic files,
`match/captions.yml` and `match/removal.yml`; the owner's real configuration was never opened.

Only L15 saved anything, and only that launch took a byte check — a removal changes a span, which the
three read-only plans do not.

## 26. Item 1 — a caption per arm. **PASS**

L11, the snippet whose `triggers:` list holds **both** a scalar item and a nested sequence, so both
arms are drawn in one field and the captions can be compared side by side.

```
mixed f0 Trigger fieldChildren: p.name div.shownValue div.shownValue p.kind
mixed f0 Trigger v0: span.marker="Triggers"@658,172,491x14
                   | span.marker="shown here as the file writes it"@658,188,491x14
                   | div.sourceText=":mix"@658,204,491x30
mixed f0 Trigger v1: span.marker="Triggers"@658,238,491x14
                   | span.marker="This value is not one piece of text, so what is named here is its
                                  shape and not the characters the file holds."@658,254,491x29
                   | span.marker="a list"@658,285,491x14
```

**`fieldChildren` is the evidence for the removal**: between `p.name` and the first `div.shownValue`
there is now **nothing**. The blanket `valueAsWritten` that used to sit above the whole list — and
that claimed the localized words *a list* were the file's own bytes — is gone from the DOM, not merely
overridden.

And each entry carries the caption that is true of it: the scalar `:mix` is captioned *shown here as
the file writes it* and drawn through `SourceText`; the nested item is captioned with the new
**shape-only** sentence and then named `a list`. The new caption is **491×29 of real drawn text**, two
lines tall, so it is on a screen rather than merely in a string table.

## 27. Item 2 — the `unmodelledShape` wording against what is drawn. **PASS, with one case not reachable**

Three shapes of a `label:` this application does not model as text, all in L11.

```
unmod    f2 Label v0: span.marker="shown here as the file writes it" | div.sourceText="nested: value"
unmod    f2 Label kind: This file writes this key as something other than a single piece of text, so
                        this app cannot edit it as one and will not write over it. This field is
                        shown and not edited.

emptyseq f2 Label v0: span.marker="shown here as the file writes it" | div.sourceText="[]"
emptyseq f2 Label kind: (the same sentence)

bare     f2 Label fieldChildren: p.name p.kind
bare     f2 Label shownValues: 0
bare     f2 Label kind: This key is in the file with nothing after it, so there is no value here to
                        replace. Writing one has to be done in the file itself for now, so this field
                        is shown and not edited.
```

**The sentence and the screen agree.** A `label:` written as a nested mapping draws `nested: value`
under the *as the file writes it* caption, and the refusal beside it now says only that the key cannot
be edited as a single text field and will not be written over — it no longer claims this application
cannot show what the key holds while showing exactly that. Written as `[]` it draws `[]`, same
sentence, still consistent.

**The empty-`value_text` case could not be constructed.** Both non-scalar shapes tried have non-empty
source text (`nested: value`, `[]`), and a key with **nothing** after the colon turns out not to be
`unmodelledShape` at all — it is `ownsNoBytes`, a different refusal, which draws **no value and makes
no claim about one** (`shownValues: 0`, `fieldChildren: p.name p.kind`). So the `[]` guard in
`shownValuesOf` was not exercised from a window, and this reading does not claim it was. What it does
establish is the neighbouring case: the one shape that genuinely has nothing to show says nothing, and
that is the behaviour the wording was written to survive.

**Incidental gain:** `ownsNoBytes` reached a screen for the first time. §16's fourth hole named it as
having model-suite evidence only; that is now one refusal smaller.

## 28. Item 3 — the typed reprojection reason. **PASS, both reachable arms**

L13, then L14 after the probe was corrected.

**Codex's repro — select another snippet in the *same* file while saving:**

```
otherSnippet panel0 p.kind: "This window has moved to another snippet in this file, so it cannot read
                             this one again. Stop editing, then pick this snippet again from the list."
otherSnippet panel0 buttons: [Read this snippet again DISABLED]
```

**It no longer says the window is no longer showing the file**, which was the false sentence; it names
the snippet, and it names the way out that actually exists. The control is disabled rather than absent.

**`otherFile`, reached in L14:**

```
otherFile panel0 p.kind: "This window has moved to another file, so it cannot read this snippet again.
                          Stop editing, open the file again, and pick the snippet from there."
otherFile panel0 buttons: [Read this snippet again DISABLED]
```

**A note on how it is reached, because L13 got it wrong and the wrongness was mine, not the
product's.** Clicking a *file* row in the sidebar moves the snippet list but leaves `selectedMatch`
where it was, so the editor still sees the same document and still reports `otherSnippet` — measured
as an intermediate `fileRowOnly` reading in L14, and correct. A **snippet** of the other file has to
be picked. L13 is counted among the five launches and is not reported above as a reading of
`otherFile`.

`notProjected` was **not** provoked. It needs a commit whose adoption dropped the projection, or a
same-node-different-revision selection, neither of which this window offers a path to; that is stated
as a gap rather than skipped silently.

## 29. Item 4 — the `fieldRemoved` marker after a committed removal. **PASS**

L15, `match/removal.yml`.

```
open    f2 Label control=input readonly=false value="label to remove" kinds=[] buttons=[Take this key out]
removed f2 Label control=input readonly=false value="label to remove"
                 kinds=["This key will be taken out of the file when you save."] buttons=[Keep this key]
saved   f2 Label control=input readonly=true  value="label to remove"
                 kinds=["This key is not in the file. Leaving this box empty writes nothing; typing in
                         it adds the key."] buttons=
```

The marker appears when the removal is drafted and **is gone after the commit** — replaced by the
absent-key sentence, which is now the true one, with no removal control left to offer. Nothing on
screen still promises a write that already happened.

**Byte level**, because a removal changes a span:

```
$ diff -r <before> <after>
  5d4
  <     label: "label to remove"

anchor '    label: "label to remove"\n' occurs 1 time(s) in the before-bytes
before 219 bytes, after 190 bytes, expected 190 bytes
RESULT: byte-identical outside the one edited span
```

Exactly the 29 bytes of that line and its newline; the two comment lines, `matches:`, the trigger, the
blank line and the whole neighbouring snippet came out byte-for-byte unchanged.

**One cosmetic observation, not a defect.** Between the commit and the re-seed the box still holds the
old text `label to remove` while the sentence under it says *this key is not in the file… leaving this
box empty writes nothing*. Both halves are true — the key really is gone, and the sentence describes a
later save — but a reader could take the non-empty box for something that would be written. No action
is possible in that state: the control is `readonly=true`, the save control is disabled, and *Read
this snippet again* clears the box. It is recorded because it was seen, not because anything could be
made to follow from it.

## 30. Verdict

| Item | Verdict |
|---|---|
| 1 — a caption per arm | **PASS** — the blanket caption is gone from the DOM; a scalar item gets *as the file writes it*, a nested item gets the new shape-only sentence, both in one field |
| 2 — the `unmodelledShape` wording | **PASS** — the sentence no longer contradicts the source text drawn beside it, in two shapes; the empty-`value_text` case was **not constructible** and is not claimed |
| 3 — the typed reprojection reason | **PASS** — `otherSnippet` names the snippet, `otherFile` names the file, both with the control disabled; `notProjected` not provoked |
| 4 — the `fieldRemoved` marker | **PASS** — gone after the commit, and the file lost exactly that line and nothing else |

**No new defect.** The one thing this pass got wrong was the probe's route to `otherFile` (§28), which
is the instrument, not the product.

**What this evidence is not**, carrying over §16 and §24: pixels beyond layout geometry, pointer
hit-testing, real keystrokes, `beginSave`'s carriage-return gate, `code.draftError.*`, the
`notDecodable` refusal, `notProjected`, the conflict and refused outcome arms, and the real
configuration. `ownsNoBytes` leaves that list this pass (§27).

## 31. The probe, and its removal

**Fourth time.** `src/probe.ts` was deleted; `src/main.ts` and `src-tauri/src/main.rs` were restored
from the copies taken before the probe first existed and compared with `diff`: **`main.ts IDENTICAL`,
`main.rs IDENTICAL`**. `git status --short --untracked-files=all` afterwards holds no probe file and
no probe artefact; every scratch path lived outside the repository.

`dist/` was rebuilt from the reverted source: **158 modules**, with no `svelte/internal/server` and no
`node:async_hooks` in the bundle. During the reading it was 159 — 158 plus `probe.ts`, the same shape
as every earlier pass. Re-run afterwards, all passing:

```
npm test            38 files, 1020 tests
npm run check       394 files, 0 errors, 0 warnings
npm run build       158 modules
cargo test --workspace   1008 tests, 0 failed
```
