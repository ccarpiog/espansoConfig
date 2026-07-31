# Phase 1c-2a — the detail pane renders the match

The third pane stops being a placeholder. Plan section 3.3's fields, section 3.4's variables and
section 3.5's form fields are on screen, in both languages, with every value shown as the source
text the file holds.

**1c-2 was split by failure mode.** This sub-phase is *the match's own content* — what the
projection says the file contains. 1c-2b is *what the app says about it*: the hazards, the
diagnostics and the raw YAML viewer. The split is not by size but by what a mistake costs: a wrong
field label is a wrong label, while a wrong hazard is a false claim about whether the editor may
touch a construct.

---

## 1. What was built, in one paragraph each

**`src/lib/browser/detail.ts`** — the model. `describeMatch(match)` answers one object holding
every row, block and card the pane draws; `flattenValue` turns a `ValueView` into a flat list of
lines with a depth on each; `describeVariable`, `scalarRow`, `styleWorthShowing`, `hasOptions` and
`indentClass` are the pieces it is assembled from. **Nothing in it looks at a scalar's text.**

**`src/lib/components/DetailPane.svelte`** — presentation. Five snippets (`scalarText`, `rows`,
`lines`, `block`, `unknownEntries`) and one walk over the model. The deliberate stub of 1c-1 is
gone; `browser.detail.placeholder` went with it.

**`src/lib/i18n/`** — 50 keys added and one removed, in both dictionaries; `describeValueKind` in
`codes.ts`; `unknownCountKey` and `describeUnknownCount` in `plural.ts`; three reactive accessors in
`index.ts` (`tValueKind`, `tDetailField`, `tUnknownCount`). Four pre-existing
`code.unknownReason.*` values were **rewritten** while closing the review; section 14, finding 1.

**`src/lib/browser/fixtures.ts`** — the neutral builders grew a variable, a mapping entry, an alias,
an elided node, an unknown entry, a styled scalar, the four content fields it did not model and a
general option override.

---

## 2. Why the logic is not in the component

`docs/decisions/1c-1-notes.md` hole 1: **no automated test in this repository renders a Svelte
component.** The whole frontend suite passes without instantiating one, so a component that throws
produces a blank pane the suite sails through, and 1b-1's blank window is the precedent.

That hole is not closed here — adopting `jsdom` and a component-testing library is a decision with
its own costs and it belongs to whoever needs it — so this sub-phase does the next best thing and
**moves everything that can be wrong into a module a test can drive**. The rule applied was: if a
line decides *what appears*, it goes in `detail.ts`; if it decides *how it looks*, it goes in the
component.

Two lines were written in markup first and moved out on the same day:

- the variable card's rows started as `[variable.type, variable.injectVars].filter(…)` in the
  template. It type-checked. It was also the exact thing this section forbids, and it is now
  `VariableDetail.rows`;
- `formFields` started as a labelled block, which put a field label and a section heading with the
  same words one above the other. It is a bare line list under its own heading now.

What is left in the component is a walk, four `{#if}`s over the model's `null`s, and the CSS.
`detail.test.ts` ends with a **text scan** of `DetailPane.svelte` — that it names every accessor it
must call, that it hands `t(` no built key, and that the stylesheet has a rule for every
indentation class the model can produce. That is a weak instrument and it is labelled as one in the
file: it can say the component still *mentions* `tScalarStyle`, never that it renders anything.

---

## 3. Absent is not empty — and the one place the wire cannot tell them apart

Every scalar field of the view is `ScalarView | null`. `null` means **the file does not have this
key**; a present key holding an empty string is a different fact about the file.

So `scalarRow` answers `null` for an absent field and the pane draws **no row at all** — no label,
no "not set", nothing. A present field whose text is empty draws a row carrying `empty: true`, and
the pane prints `browser.detail.emptyText` in the marker face rather than the empty string, because
a row with nothing in it is indistinguishable from a row that failed to render.

The deliberate exceptions, both of them statements about a *shape* rather than about a field:

- **the trigger kind and the content kind are always drawn**, including `Absent`. A match with no
  content reads "Content form: No content", which is the honest rendering of a real espanso error;
- **an option group with no rows draws no heading**, and the Options section disappears entirely
  when `hasOptions` is false. Four empty headings say nothing that the absence of the section does
  not say better.

**The hole this leaves is real and belongs to the core.** `triggers`, `search_terms` and
`depends_on` cross the wire as plain arrays, so `triggers: []` written in a file and no `triggers:`
key at all arrive **identically** as `[]`, and no function here can tell them apart. The pane
therefore draws nothing for both, which is right for one of them and wrong for the other. Closing it
means a presence flag beside each sequence on `TriggerSpec`, `MatchView` and `VariableView`; it is
hole 2 of section 6.

---

## 4. D2u in the pane: three things said about a scalar, none of them its meaning

Every value on screen is `ScalarView.text`. There is **no checkbox anywhere in this pane**, no
toggle, and no badge derived from a value: `word: on` renders as the two characters `on`, and the
R32 reading in section 5 has it on screen doing exactly that.

Three things are said *about* a scalar, and each is a claim D2u permits:

1. **`empty`** — a fact about its length.
2. **`ambiguous_yaml_1_1`** — the core's own flag, rendered as a short chip with the long sentence
   on its `title`. This is *a claim about risk, not about meaning*, which `PROGRESS.md` states
   explicitly as the permitted half of R16's open question. The reading shows it on `on`, on `true`,
   on `false` and on `0`, and **not** on `UTC` or on `capitalize`, which is the core's judgement
   showing through unaltered.
3. **`style`**, through `tScalarStyle` — and only when it is not `Plain`. A plain scalar's text *is*
   its bytes, so "written without quotes" beside every row is noise; every other style means the
   text shown differs from the spelling in the file, and in a fidelity-preserving editor that
   difference is exactly what a reader should be able to see. `styleWorthShowing` is one line and it
   has its own test in both directions.

`ScalarView.decoded` is carried and nothing shows it. That is hole 8.

---

## 5. The trigger and the content sides are never collapsed

`TriggerSpec` carries `trigger`, `triggers` and `regex`; `ContentSpec` carries all five content
fields. **The pane draws every one the file has.** A match writing both a `trigger` and a `regex` —
`TriggerKind::Several`, which the core reports and which is in the R32 reading — draws two rows.

This is not a preference. The 1c-1 review removed a first attempt at this pane precisely because it
rendered the trigger through `triggerLabel`, the **snippet list's** helper, which deliberately
collapses the three forms into one display value. In a list that is correct and in a detail pane it
hides the one thing the pane exists to show. `detail.ts` therefore does not import from `labels.ts`
at all, and `shows a trigger and a regex as two rows when the file holds both` is the test; a model
that collapses them fails it (experiment C).

The content rows are in plan section 3.3's own order — `replace`, `form`, `markdown`, `html`,
`image_path` — rather than in the order `ContentSpec` declares them, because the plan's order is the
one the user's documentation uses.

---

## 6. Options grouped by intent, and the instruction that is about editing

Plan section 8.5: *"Not a flat dump of every schema field"*. The nine options are in four groups —
**Word boundary** (`word`, `left_word`, `right_word`), **Capital letters** (`propagate_case`,
`uppercase_style`), **Insertion method** (`force_mode`, `force_clipboard`) and **Other**
(`paragraph`, `anchor`) — and `label`, `comment` and `search_terms` are in their own section, which
is section 8.5's "Discovery" group under a name a user would recognise.

The plan also says: *"Do not expose `force_mode` and `force_clipboard` as two unrelated checkboxes.
Present a single **Insertion method** control."* That is an instruction about **editing**, and this
pane does not edit. It is honoured as far as reading allows: both keys sit under one heading, so
they read as one decision — and each still shows its own source text, because rendering two keys as
one value would be the inference D2u forbids, arrived at from a different direction.

---

## 7. Variables, forms and the entries nobody modelled

A variable is a card: its **name is the heading**, rendered through the same scalar snippet as any
other value so that a quoted or ambiguous name still gets its chips. Then `Read as: <kind>` — which
is the app's classification, labelled as the app's — then the `type` row, which is the file's own
text and the authoritative one. The two are deliberately separate lines: `type: nonsense` reads
"Read as: Type this app does not recognise" above "Type / nonsense", and both facts are true.

`params` is a **shallow** projection, so it is flattened with `flattenFields` and rendered as
indented lines: a scalar entry is one line, a nested mapping or sequence gets a header line naming
its shape (`tValueKind`) and its children one level in. `depends_on` and `search_terms` and
`triggers` go through `flattenItems`, which adds no header of its own because the block already
carries the field's label.

**Order is the file's order, everywhere.** `flattenFields` does not sort, and `flatten a shallow
mapping in source order, never sorted` fails if it does (experiment F). Plan section 8.4's "never
hide the file boundary" applied to a mapping instead of to a file: a user who wrote `format` before
`tz` sees `format` before `tz`.

`unknown_entries` is surfaced on **both** the match and every variable, with the key's own text for
the what — `browser.detail.unnamedKey` when the key is not a scalar — `tValueKind` for the *shape*
of the value, and `tUnknownReason` for the why. The core's contract is that these are never
discarded; a pane that dropped them would make that contract invisible to the only person who could
act on it.

**The value itself is not on screen, and no string says otherwise.** `UnknownEntry` carries
`key`, `key_node`, `key_span`, `value_span`, `value_kind`, `path` and `reason` — **no value text at
all** — so the pane could not print it even if it wanted to, and reconstructing it here from
`value_span` is exactly the byte/character confusion `CharToByte` exists to prevent: a JavaScript
string index is a UTF-16 offset and a `ByteSpan` is not. So the entry says *"holds a set of keys,
which this pane does not show"* and the count says the entries were *recorded and left untouched*,
which is a claim about what the app does to the file rather than about what is on screen. The
strings said "is shown as written" until the phase's review; that was finding 1, it is section 14,
and what remains of it is hole 13.

---

## 8. The strings, and where the lint cannot see them (R31)

**50 keys added, one removed.** The dictionaries hold **218 keys each**: 111 `code.`, 82 `browser.`
(53 of them `browser.detail.`), 16 `menu.`, 9 others. The base is commit `0507f6f`, where they held
**169**; `browser.detail.placeholder` is the one removal, and 169 − 1 + 50 = 218. The review's own
figure was 49 added at 217 keys, and it was right about the code as reviewed: closing its first
finding added `browser.detail.unknownValue`, the sub-phase's fiftieth addition. **The record
previously said "51 keys added" here and in section 1 and "50 new Spanish values" below, and all
three were wrong** — finding 4 of section 14. The 218 was measured from the two files; the 169 is
the review's figure for the base commit and was not re-derived, because closing this review ran no
git command.

**No key of the `code.` namespace was added or removed**, which matters:
`src-tauri/src/dictionary_contract.rs` filters on `code.` and compares it against the Rust enums in
both directions, so a `code.detailField.*` key would have failed `cargo test`. The field labels are
a frontend union, not a Rust enum, and they live under `browser.detail.field.`. Four `code.` *values*
did change — the `code.unknownReason.*` sentences — and a value is not a key, so the contract test
is indifferent to them.

**A component calls an accessor and never builds a key**, and the field labels obey it the same way
the sixteen enum namespaces do. `detailFieldKey` in `detail.ts` returns
`` `browser.detail.field.${DetailFieldName}` `` **typed as `TranslationKey`**, so a field with no
dictionary entry is a compile error in that file — experiment M deletes one key and
`svelte-check` names `detail.ts:110`. The component calls `tDetailField`, the sixteenth accessor.

`scripts/lint/hardcoded-strings.ts` sees `.svelte` **markup** only. These are the places this
sub-phase put user-facing text where it cannot see, each a `t()` or an accessor call and none a
literal:

1. **`title={t('browser.detail.ambiguousDetail')}`** — an attribute whose value contains `{`, which
   the scanner skips by construction (its hole 2).
2. **`detail.ts`'s `detailFieldKey`** — a `.ts` file (hole 3). It contains one template, checked
   against `TranslationKey` at compile time, and **no component calls it**: they call
   `tDetailField`.
3. **`plural.ts`'s `unknownCountKey`** — the same, over a key *pair*.
4. **Every string the five snippets render arrives through a snippet parameter** — a prop, which is
   the scanner's hole 4. The alternative was the same twenty lines of markup five times.

`scripts/lint/built-translation-keys.ts` covers the other half and does see this file: experiment L
makes the pane build a key and both the lint suite and the pane's own text scan fail.

**Nothing establishes that the 50 new Spanish values are Spanish**, nor the four rewritten ones.
`dictionaries.test.ts`
establishes non-identity and one exception was added by name —
`browser.detail.section.variables`, "Variables" in both languages, the same word spelled the same
way. That is hole 7, and it is bigger than it was.

One thing the reading caught that no check could: the Spanish had **two words for one concept**.
`code.contentKind.replace` is "Texto de sustitución" and the new `browser.detail.field.replace` was
"Texto de reemplazo", and the two appeared one above the other on screen. Aligned.

---

## 9. The disabling experiments

Each is one edit, run against the code as it stands, recorded, and reverted. **Eighteen fired; two
did not, and the two that did not are the more interesting.** Q, R, S and T were run while closing
the review (section 14) and are the evidence that its three code findings are shut rather than
merely edited over.

| # | The break | What fired |
|---|---|---|
| A | `scalarRow` invents a row for an absent field | 9 tests, `answers null for an absent key` and `keeps absent and empty apart on a whole match` among them |
| B | `scalarDisplay.empty` is always `false` | `answers a row for a present key, and marks an empty value`, `keeps absent and empty apart` |
| C | the trigger side collapses to the first present field, as the list does | `shows a trigger and a regex as two rows when the file holds both`, `covers every field the model can actually produce` |
| D | `styleWorthShowing` returns every style, `Plain` included | `hides the style of a plain scalar and shows every other one` |
| E | `flattenValue` returns no line for an `Elided` node | `says the projection stopped, and at what, for an elided node`, `renders a parameter whose value is elided, an alias, a mapping or a sequence` |
| F | `flattenFields` sorts entries by key | `flatten a shallow mapping in source order, never sorted` and the parameter-shapes test |
| G | `propagate_case` moves into the word-boundary group | `puts each of the nine in the group plan section 8.5 names` |
| H | `indentClass` answers `depth-0` past the deepest rule instead of clamping | `clamps rather than falling back to no indentation at all` |
| I | `unknownCountKey` always answers the plural | `picks the singular for exactly one…`, `agrees in number in both languages` |
| J | the pane stops calling `tScalarStyle` | `calls tScalarStyle, so that code reaches the screen as words` |
| K | the `.depth-5` rule is deleted from the stylesheet | `has a stylesheet rule for every indentation class the model can produce` |
| L | the pane writes `t(unnamedKeyKey())` | `holds no t( whose key is not written out`, and `built-translation-keys.test.ts` on `DetailPane.svelte` |
| M | `browser.detail.field.word` is removed from `en.json` | `npm run check` — a type error **in `detail.ts`**, at the key builder, naming the field |
| O | a literal `<h2>Trigger</h2>` in the pane's markup | `hardcoded-strings.test.ts` on `DetailPane.svelte` |
| Q | a 25th `DetailFieldName` member, given a label in both dictionaries and in `EVERY_DETAIL_FIELD`, and **never emitted** by `describeMatch` | `are all of them emitted, for a match that sets every field there is` — *"expected [ 'anchor', 'comment', …(22) ] to deeply equal [ 'anchor', 'comment', …(23) ]"*. This is the review's own failure scenario, and the test it replaced passed it |
| R | `'injectVars'` deleted from `EVERY_DETAIL_FIELD` | `npm run check` — *"Type '\"injectVars\"' does not satisfy the constraint 'never'"* at `detail.test.ts:108`. The other direction of the same list |
| S | the `{:else if line.label.kind === 'item'}` arm deleted from the pane | `handles the item branch, so a sequence item is not just another line` |
| T | the value-shape marker deleted from the pane's `unknownEntries` snippet | `says what shape an unmodelled entry holds, because it cannot show the value` |

### 9.1 The two that did not fire, and what they mean

| # | The break | What happened |
|---|---|---|
| N | a genuinely unused selector (`.never-used-anywhere`) added to the pane's `<style>` | **`npm run check` reported 0 errors and 0 warnings.** `svelte-check` at this project's settings does not surface the compiler's unused-CSS warning at all |
| P | the same unused selector, through `npm run build` | **It survives into `dist/assets/*.css`.** The production build does not prune it either |

Together these say something worth writing down: **"`depth-0` … `depth-5` are present in the built
CSS" is not evidence that they are used**, because an unused rule would be present too. The evidence
that the indentation is wired is experiment K plus `indentClass`'s own tests — the class is computed
by tested code, the rule exists, and the two names agree. The evidence that the padding *paints* is
nothing at all; see hole 6.

Experiment N also retires a claim it would have been easy to make: a clean `npm run check` says
nothing about this pane's CSS.

---

## 10. What the phase got wrong on the way

1. **`form_fields` was given a field label as well as a section heading**, so the same words would
   have appeared twice, one above the other. It also named a member `DetailFieldName` did not have,
   which `detailFieldKey`'s return type would have refused — the compile-time check earning its
   keep before the first run.
2. **The variable card filtered its rows in markup.** `[variable.type, variable.injectVars].filter(…)`
   type-checked and worked, and it was logic in the one file no test can reach — the exact thing
   section 2 says this sub-phase will not do. It is `VariableDetail.rows` now.
3. **The unmodelled-entry sentence said "of this snippet", and the reading showed it inside a
   *variable*.** A variable's own unknown entries render in its card, where "of this snippet" is
   simply false. Reworded in both languages to say nothing about what the entry belongs to; the
   surrounding card and section say that. **Found by looking at a screen, not by a test** — nothing
   in the suite could have noticed, because every assertion about that sentence is about its
   *number*.
4. **The Spanish disagreed with itself**, section 8's last paragraph.

---

## 11. R32: what was seen in a running application

**A process that stays up is not a screen that renders**, and a passing suite is not either. So
this is what was actually observed.

### 11.1 The setup

The technique is 1c-1's, reused unchanged (`1c-1-notes.md` section 10.3): `npm run build && cargo
build -p espansoconfig --features custom-protocol`, the binary placed in a hand-assembled
`espansoConfig.app` (`Contents/MacOS` + `Info.plist`), ad-hoc code-signed, launched through
LaunchServices with

```sh
open --env "XDG_CONFIG_HOME=<scratch>/xdg" --env "HOME=<scratch>/home" --stdout <log> <scratch>/espansoConfig.app
```

and a **temporary probe** — a `render_probe` command in `src-tauri/src/main.rs` that prints its
argument, and a block in `src/main.ts` that 2.5 seconds after mount reports the three panes'
`getBoundingClientRect()` and `document.body.innerText`, then **clicks each snippet row in turn**
and reports the detail pane's `innerText` plus the `title` of every element carrying one.

**The configuration it read was synthetic and hand-written for this run** — one profile and one
match file under `<scratch>/xdg/espanso`, holding five matches: one with a literal block, a quoted
label, an **empty** comment, search terms and six options; one with **both** a `trigger` and a
`regex`; one with three variables including an unrecognised type and an unmodelled key; one form;
and one with a top-level key the app does not model. The owner's real configuration was never
opened: `XDG_CONFIG_HOME` is the first candidate `resolve_config_dir()` probes and `HOME` was
overridden on every run. Nothing in this document, in any test or in any file kept in the repository
quotes real configuration content.

Both patched files were restored from copies taken before the edit and compared byte-for-byte
afterwards; `rg render_probe` over `src`, `src-tauri/src` and `scripts` finds nothing, `dist/` was
rebuilt from the restored source, and all six commands were re-run afterwards and all pass.

**What this is evidence of:** what WebKit actually laid out and rendered in the real application's
webview. **What it is not:** pixels. It cannot see a pane painted white-on-white, a `z-index`
accident, or an indentation rule that failed to apply. That is hole 6.

### 11.2 The readings, as the sub-phase ended

Taken in both languages and **re-taken after the two wording changes section 10 records**; the
English reading is byte-identical across the re-take and the Spanish differs only in the aligned
value.

**Two things below are now historical**, because the review's first and second findings changed the
pane after this reading was taken: the unmodelled-entry sentences quoted for the third snippet are
the pre-review wording, and no sequence item carried a bullet yet. Section 11.3 is the reading of
the pane as it now stands, and it is the current one.

Geometry, identical in both languages: viewport `1180x728`, `.sidebar x=0 w=268`, `.list x=268
w=375`, `.detail x=644 w=536`, each `h=645`. Five list rows, five sidebar rows.

**The first snippet, English**, `section.detail` `innerText` verbatim:

> File / match/base.yml / TRIGGER / Trigger form: One trigger / Trigger / :sig / Written between
> double quotes / CONTENT / Content form: Replacement text / Replacement text / Best regards, /
> A. Example / Written as a literal block / LABEL AND SEARCH / Label / Signature / Written between
> single quotes / Comment / written as empty text / Written between double quotes / Search terms /
> sign / closing / OPTIONS / Word boundary / Whole word / on / Ambiguous / Boundary on the left /
> true / Ambiguous / Capital letters / Follow the case that was typed / true / Ambiguous /
> Capitalisation style / capitalize / Insertion method / Insertion mode / clipboard / Other /
> Paragraph / false / Ambiguous

Four `title` attributes, each *"The two versions of YAML read this value differently, so it is shown
exactly as the file writes it."* — and in Spanish, *"Las dos versiones de YAML leen este valor de
forma distinta, así que se muestra tal y como lo escribe el archivo."*

Five things in that block are the phase's claims, seen rather than assumed:

- **`word: on` is the two characters `on`.** D2u on a screen.
- **The ambiguity flag is on `on`, `true`, `false` and `0`, and not on `capitalize` or `UTC`.** The
  core's judgement, unaltered, and `tScalarStyle`/`ambiguous` are the first callers either has had.
- **`Comment` shows "written as empty text"** — a present key with an empty value — while the
  second snippet, which has no `comment:` key, shows **no Comment row at all**. Absent and empty,
  side by side, on two screens.
- **The block scalar keeps its two lines** and is labelled "Written as a literal block".
- **The `label` is `Signature` with "Written between single quotes"**: the text decoded, the
  spelling reported.

**The second snippet** is the one that matters most: *"Trigger form: Several kinds of trigger at
once / Trigger / :both / Regular expression / gr(a|e)y"* — **two rows**, which is what the 1c-1
review's finding was about.

**The third** renders three variable cards: `today` / "Read as: Date" / `Type date` / Parameters
`format %Y-%m-%d`, `offset 0` (Ambiguous), `tz UTC`; `pick` / "Read as: Choice" / `Type choice` /
`Inject variables false` / Parameters `values` → **"a list"** → `alpha`, `beta` / Depends on →
`today`; and `odd` / "Read as: Type this app does not recognise" / `Type nonsense` / *"1 entry is
shown as written and left untouched."* / `surprise` / *"espansoConfig has no field for this key, so
it is shown as written and left untouched."* — **those two sentences are the defect the review's
first finding was about**, quoted here as they were then and gone from both dictionaries now; the
same card in section 11.3's reading says *"1 entrada se registró y se dejó intacta"* and names the
shape of the value it does not show. The `values` and `depends_on` lines above them carry no
bullets in this reading and do in that one, which is the second finding.

**The fourth** shows a form: "Content form: Form", the layout block, then FORM FIELDS with `note` →
"a set of keys" → `multiline true` (Ambiguous), `default` → "written as empty text".

**The fifth** shows the match-level unknown entry under its own heading.

**The Spanish reading is the same screen in Spanish**, at identical geometry: *DISPARADOR / Forma
del disparador: Varias clases de disparador a la vez / CONTENIDO / Forma del contenido: Texto de
sustitución / ETIQUETA Y BÚSQUEDA / Términos de búsqueda / OPCIONES / Límites de palabra / Palabra
completa / on / Ambiguo / Mayúsculas / Método de inserción / Otras / VARIABLES / Se lee como: Fecha
/ Parámetros / una lista / Depende de / CAMPOS DEL FORMULARIO / un conjunto de claves / escrito como
texto vacío / ENTRADAS QUE ESTA APLICACIÓN NO MODELA / 1 entrada se muestra tal cual y no se toca.*
The snippet's own text — `Best regards,`, `gr(a|e)y`, `alpha`, `%Y-%m-%d` — stays as the file writes
it, which is the correct behaviour and worth seeing rather than assuming.

**What the readings do not establish**, beyond pixels: no `Alias` value and no `Elided` value was
ever on screen (section 12, holes 3 and 4), no key that is not a plain name was on screen, and the
configuration was one file with five matches — no package, no `_`-prefixed file, no second file and
no search.

### 11.3 The reading re-taken after the review round

**The pane changed, so the reading was taken again.** Findings 1 and 2 both edit
`DetailPane.svelte`, nothing in this repository renders a Svelte component, and this project has
already shipped a window that "launched and stayed up" while being blank. A claim about a screen
needs a reading of a screen.

Same technique, same hand-assembled bundle, same overridden `XDG_CONFIG_HOME` and `HOME`, same
temporary `render_probe`. **The synthetic configuration grew two things written for this reading**,
both on the fifth match and both chosen to be the two findings' own failure scenarios:

- a `search_terms` list of **two** items whose **first is a literal block of two lines** — the
  review's exact example of two items that used to render as three unmarked lines;
- a second unmodelled key holding a **mapping**, beside the scalar one already there, so the pane
  has two shapes to name and a plural to agree with.

Geometry, unchanged and identical in both languages: viewport `1180x728`, `.sidebar x=0 w=268`,
`.list x=268 w=375`, `.detail x=644 w=536`, each `h=645`.

**The fifth snippet, English**, `section.detail` `innerText` verbatim:

> LABEL AND SEARCH / Search terms / • / one term / written over two lines / Written as a literal
> block / • / a second term / ENTRIES THIS APP DOES NOT MODEL / 2 entries were recorded and left
> untouched. / not_a_field / holds a single value, which this pane does not show / espansoConfig has
> no field for this key, so the entry was recorded and is kept exactly as the file writes it. /
> unmodelled_block / holds a set of keys, which this pane does not show / espansoConfig has no field
> for this key, so the entry was recorded and is kept exactly as the file writes it.

**The same screen in Spanish:**

> ETIQUETA Y BÚSQUEDA / Términos de búsqueda / • / one term / written over two lines / Escrito como
> bloque literal / • / a second term / ENTRADAS QUE ESTA APLICACIÓN NO MODELA / 2 entradas se
> registraron y se dejaron intactas. / not_a_field / contiene un valor suelto, que este panel no
> muestra / espansoConfig no tiene ningún campo para esta clave, así que la entrada se ha registrado
> y se conserva exactamente como la escribe el archivo. / unmodelled_block / contiene un conjunto de
> claves, que este panel no muestra / …

Four things in those two blocks are the fixes, seen rather than assumed:

- **two bullets for two items, and the first item is two lines long.** That is finding 2 closed on a
  screen: the marker is in the DOM's text, so `innerText` can see it, which a `content:` rule in the
  stylesheet could not have been;
- **the bullets are on the other sequences too** — the first snippet's `search_terms` reads
  *"Search terms / • / sign / • / closing"*, and the third snippet's `values` reads *"Parámetros /
  values / una lista / • / alpha / • / beta"* with *"Depende de / • / today"* under it;
- **`holds a set of keys, which this pane does not show`** — the shape named, the value admitted
  missing. No string anywhere now says an unmodelled entry is shown;
- **the count agrees in number in both languages** on a real plural, which the earlier reading only
  ever saw in the singular.

The two patched files were restored from copies taken before the edit and compared **byte-for-byte**
afterwards — and also against the copies the earlier reading took, which agree — `rg render_probe`
over `src`, `src-tauri/src` and `scripts` finds nothing, `dist/` was rebuilt from the restored
source, and all six commands were re-run afterwards and all pass.

**One thing the re-take also found out about the instrument.** The first run switched language in
the same session and stopped reporting after the eighth of its ten reads; the window was in the
background and WebKit throttles timers for an occluded window, so a long chain of `setTimeout`s is
not a reliable probe. The reading above was taken as two short runs instead, the second of which
started in Spanish because the override persists in the scratch `HOME`. **A probe that stops early
looks exactly like a probe that finished**, which is worth remembering the next time one is written.

---

## 12. Coverage holes, stated as holes

1. **No component is rendered by any automated test.** Inherited from 1c-1 and unchanged. The
   evidence for this pane is section 11 and a text scan that can only see whether the component
   *names* an accessor. A pane that stopped rendering a block it was given would pass everything in
   this repository.
2. **An absent sequence and an empty one are the same on the wire.** Section 3. `triggers: []` and
   no `triggers:` key both arrive as `[]`, and the pane draws nothing for both. The fix is a
   presence flag in the core, not a guess here.
3. **`Elided` was never seen on a screen.** `MAX_VALUE_DEPTH` is 64, so provoking one needs a
   64-level nest, which is not a thing to put in a fixture a human reads. It is unit-tested in three
   places and rendered by code no reading exercised.
4. **`Alias` was never seen on a screen either**, for the same kind of reason: it needs an anchor,
   and the reading's file has none. Unit-tested only.
5. **A `FieldView` whose key is not a scalar was never seen on a screen.** Unit-tested only.
6. **No pixels, and the indentation in particular is unverified.** Experiments N and P show that
   neither `svelte-check` nor `vite build` would notice a dead CSS rule, so nothing mechanical says
   the `depth-*` padding paints. **The `depth-*` ladder moved to `src/app.css` in the cleanup pass
   of section 15 and the move itself was not seen on a screen**, which widens this hole rather than
   changing its kind: the rules are unscoped now, so a class the markup writes reaches them, and
   `dist/assets/index-*.css` holds them un-suffixed — but "the selector exists and is not
   hash-scoped" is still not "the padding paints". The layout is known from `getBoundingClientRect`, the text from
   `innerText`, and the machine's screen-recording permission is still what stands between this
   phase and a screenshot. **The sequence bullet is half inside this hole and half outside it**: the
   glyph is in the markup, so `innerText` sees it and section 11.3 did — but its `.bullet` rule is
   a stylesheet rule like any other, and if it were deleted the bullet would still be there in the
   wrong colour with nothing reporting it. The rule's *existence* is asserted by
   `handles the item branch…`; its effect is not.
7. **The Spanish is unreviewed prose, and there are 50 more values of it**, plus four rewritten.
   `dictionaries.test.ts`
   establishes non-identity and nothing establishes that a value is Spanish. One value was found
   inconsistent with an existing one by *reading a screen*, which is the only instrument that has
   ever caught anything here.
8. **`ScalarView.decoded` is carried and nothing shows it.** It is the difference between "this text
   is the file's bytes" and "this text is what the decoder made of them", which is arguably worth a
   marker beside the style.
9. **Nothing shows a value's span, node or path.** They are on the view and a reader who wants to
   find a snippet in their editor has only the file name.
10. **A value nested past `MAX_INDENT_DEPTH` renders at the same indentation as its parent.** The
    clamp keeps it legible and loses the distinction; nothing on screen says the nesting continued.
11. **Nothing runs a real projection through `describeMatch` in a test.** The fixtures are
    hand-written wire shapes, exactly as in 1c-1 hole 2. Rust pins what the projection contains,
    TypeScript pins what this model does with one, and the window reading is the only place the two
    have ever met.
12. **The reading is one file with five matches.** No package, no disabled file, no second file, no
    search, and no selection notice — the notice area is inherited from 1c-1 and was not provoked.
13. **An unmodelled entry's value is not on the wire, so it is not on screen.** `UnknownEntry`
    carries `key`, `key_node`, `key_span`, `value_span`, `value_kind`, `path` and `reason` and **no
    value text**. The pane therefore shows the key, the shape (`tValueKind`) and the reason, and
    says in so many words that it does not show the value; the strings that claimed otherwise are
    gone (section 14, finding 1). **Closing this is a Rust-side change, not a frontend one**:
    somebody has to carry an exact source slice for `value_span` across the boundary, because byte
    slicing must stay in Rust — a JavaScript string index is a UTF-16 offset, a `ByteSpan` is not,
    and this project's whole premise is byte fidelity. Reconstructing the text here would be the
    exact confusion the core's `CharToByte` adapter exists to prevent. It is section 13's, and it is
    the same shape of problem as `MatchView.source_text` having no reader: the bytes are the honest
    thing to show, and showing them needs the bytes.

---

## 13. What 1c-2b inherits

- **The pane, and the rule that keeps it thin.** New work that decides *what* appears goes in
  `detail.ts` beside `describeMatch`; the component gets the walk. The text scan at the end of
  `detail.test.ts` is where a new accessor gets its cheap guard.
- **`tHazard` (ten strings) and `tDiagnostic` (22 strings) still have no caller at all.** They are
  1c-2b's, by the split this sub-phase was made under. `MatchView.blocking_hazard`,
  `MatchView.safely_editable`, `DocumentView.hazards` and `DocumentView.diagnostics` are all live on
  the wire and nothing reads any of them.
- **The raw YAML viewer.** `document_text` is a `Workspace` method and **not a registered Tauri
  command** — `main.rs` registers six, and it is not among them. It needs a command, a wire mirror
  entry and the two contract tests updated, which is more than "add a caller".
- **The `loadFailures` conflation.** A file that could not be read still shows the same `–` /
  "Not read yet" marker as a profile nobody projected. `browser.loadFailures` holds what is needed
  to tell them apart. Named for 1c-2 by 1c-1 and not done here.
- **`MatchView.source_text`**, the match's own bytes, is on every match and nothing shows it. It is
  source text, so D2u permits it, and it stops at the match's mapping — the comment above a snippet
  is not in it.
- **A counted noun needs two keys.** There are two now (`snippetCountKey`, `unknownCountKey`), both
  in `plural.ts`, both selected on `count === 1`. A third goes beside them, not in a call site.
- **218 dictionary keys**, `en.json` still the schema, and one more exception on the
  untranslated-value list by name.
- **An unmodelled entry's value has no way to reach the screen** (hole 13). The work is in Rust: a
  source slice for `UnknownEntry.value_span`, carried across the wire beside `value_kind`, with the
  wire mirror and the two contract tests updated. Until it exists, `browser.detail.unknownValue`
  says the value is not shown, and **no string in either dictionary may claim that it is** — the
  review's first finding was exactly that claim, and it is the same class of error as D2u and R16:
  telling the user something the project has not earned the right to say.
- **The sequence bullet, and the rule about words in it.** `.bullet` is a glyph in the markup, not a
  `content:` rule, so the window reading can see it and no translation is involved. A marker that
  ever becomes a *word* goes through the i18n layer like everything else.

---

## 14. The review, and what each finding did to the code

`docs/reviews/phase-1c-2a-detail-pane.md` — no High, two Medium, two Low. The phase was held open
until all four were closed, which is what every phase since `8989c16` has done.

### Finding 1 (Medium) — the pane claimed an unmodelled entry was "shown as written", and did not show it

**What was wrong.** `unknownEntries` rendered `entry.key` and `entry.reason` and nothing else, while
six strings in each dictionary said the entry "is shown as written and left untouched". An entry
equivalent to `custom_setting: 42` produced the key, a sentence saying it was shown, and **no `42`**.
A mapping under the key disappeared just as completely.

**Why it is the one that mattered.** It is not a rendering defect, it is **a claim the project has
not earned** — the same class as D2u and R16, and the class this project is most careful about. The
app told the reader it was showing them something it was not showing them.

**What changed.** The constraint was checked first: `UnknownEntry` carries no value text at all, so
the pane *cannot* show the value and the honest fix is to stop saying it does.

- six strings reworded in both languages — `browser.detail.unknownCount.one/.other` now say the
  entries were **recorded and left untouched**, and the four `code.unknownReason.*` sentences say
  the entry **is kept exactly as the file writes it**. Both are claims about what the app does to
  the *file*, which is true, rather than about what is on the *screen*, which was not;
- one key added, `browser.detail.unknownValue`, rendering `value_kind` through the existing
  `tValueKind` accessor: *"holds a set of keys, which this pane does not show"*. The reader now
  learns the shape of the value and is told plainly that its text is not there;
- experiment T, and a scan in `detail.test.ts` that fires if the pane stops calling `tValueKind` on
  an entry;
- section 11.3 has both sentences on a screen, in both languages.

**What remains open, and whose it is.** Hole 13: the value's source text is not on the wire. Closing
it is a **Rust-side** change — an exact source slice for `value_span`, sliced in Rust, because a
JavaScript string index is a UTF-16 offset and a `ByteSpan` is not. It is named in section 13 as
inherited work. Nothing in TypeScript should attempt it.

### Finding 2 (Medium) — sequence item boundaries were invisible

**What was wrong.** `detail.ts` labels every item of a sequence `LineLabel { kind: 'item' }` and its
own doc comment called that "the bullet of a sequence item". The component rendered **nothing** for
that arm — it handled `key` and `unnamed` only — and `.lines { list-style: none }` had removed the
native bullet as well. Two `search_terms` whose first scalar holds a newline rendered as **three
unmarked lines**, and the reader could not tell two items from three. `triggers`, `depends_on` and
nested variable parameters had the same defect.

**What changed.** The pane grew the third arm and draws `<span class="bullet" aria-hidden="true">•</span>`.

- **a glyph in the markup rather than a `content:` rule**, deliberately: a `::before` string is
  invisible to `innerText`, and `innerText` is the only instrument this project has for reading a
  screen. The bullet is therefore *seen* in section 11.3 rather than assumed;
- `aria-hidden`, because the `li` already tells a screen reader it is an item, and no word is
  rendered, so nothing here needs translating. **If a marker ever becomes a word it goes through the
  i18n layer**;
- a stylesheet rule, never an inline `style`: the production CSP is `style-src 'self'` with no
  `'unsafe-inline'`, which is why `indentClass` exists at all;
- experiment S, and `handles the item branch, so a sequence item is not just another line` in the
  pane's text scan.

**Honestly stated:** the `.bullet` *rule* is subject to the same blind spot as the `depth-*` rules —
experiments N and P showed that neither `svelte-check` nor `vite build` reports an unused or deleted
selector. Hole 6 now says so.

### Finding 3 (Low) — the field-coverage test audited what the implementation emitted

**What was wrong.** `covers every field the model can actually produce` built a match setting every
field, collected the rows and blocks `describeMatch()` **chose to emit**, and asserted the distinct
count was 24. Its comment claimed a forgotten field would change the count. It would not: add a
`MatchView` field, a fixture override, a `DetailFieldName` member and a dictionary key, forget
`describeMatch()`, and the emitted set is still the same 24. This is **D2w — an audit that iterates
what the implementation emitted is vacuous** — recurring, and rewording the comment would have left
the hole.

**What changed.** The expectation now comes from the union rather than from the output.

- `EVERY_DETAIL_FIELD` is written out once and pinned to `DetailFieldName` **in both directions at
  compile time** — a member missing from the list and a name in the list that is not a member are
  each a type error, which is the device `detailFieldKey`'s return type already uses. (The spelling
  of that pin changed in section 15: it was two `assertNever<Exclude<…>>()` calls, and it is now
  `as const satisfies readonly DetailFieldName[]` plus one `ExpectNever<Missing<…>>` alias, which is
  what `codes.test.ts` had been doing thirteen times all along.)
- the test asserts the emitted set **equals** that list, so a member never emitted fails;
- the dictionary-coverage test reads the same list, so there is one list in the file rather than two;
- experiments Q and R are the two directions. **Q is the review's own failure scenario, and the test
  it replaced passed it.**

### Finding 4 (Low) — the dictionary counts were wrong and disagreed with each other

**What was wrong.** "51 keys added" in sections 1 and 8, "50 new Spanish values" in section 8. The
review's comparison against base commit `0507f6f` gives 169 keys at the base and 49 added with one
removed, reaching 217.

**What changed.** Every occurrence corrected, and the three statements now agree. The figure is
**50 added and one removed, 218 keys each**, not the review's 49 at 217: closing finding 1 added
`browser.detail.unknownValue`, and 169 − 1 + 50 = 218 is the arithmetic. The current count was
measured from the two files; the base figure is the review's, and no git command was run to
re-derive it. Four `code.unknownReason.*` **values** also changed, which is not a key change and is
stated separately in section 8 so that the next audit's key-set comparison is not surprised by it.

---

## 15. The code-quality pass after the review

A second round over the same files, from four independent quality reviews. **Cleanup, not
bug-fixing**: no intended behaviour changed, no dictionary key was added or removed (still 218 each),
and the six commands pass. Frontend tests went **412 → 425**: fourteen added, one deleted.

Three of the twelve items move a decision *out* of markup, which is the rule this phase was built
under (section 2) and the only kind of change here that alters what is on screen.

### 15.1 What changed, and why each one is more than tidying

1. **The four option groups became a list.** `OptionGroups` had four named fields, so five places
   named the same four — the interface, `hasOptions`, `describeMatch`, four near-identical
   `{#if}` + `<h3>` + rows blocks in the component, and four spreads in the test's
   `emittedFieldNames` — and **four of them failed silently** on drift. It is now
   `readonly OptionGroup[]` with `describeMatch` dropping the empty groups, so the pane's condition
   is `detail.options.length > 0` and its body is one `{#each}`. `OptionGroupName` is a code like
   `DetailFieldName`, with `optionGroupKey` beside `detailFieldKey` and `tOptionGroup` beside
   `tDetailField` — the seventeenth accessor. The union member is **`case`, not `casing`**, because
   the dictionary key is `browser.detail.options.case` and the key builder's return type is what
   makes a missing entry a compile error. `_OptionGroupsAreComplete` pins the name list.
2. **`flattenValue` calls its own helpers.** Its `Sequence` arm re-implemented `flattenItems` and its
   `Mapping` arm re-implemented `flattenFields`; both helpers took a `depth` and `flattenValue` now
   calls them at `depth + 1`. "A sequence item carries a bullet, a mapping entry carries its key" is
   stated once instead of three times, free to drift in two of them.
3. **`collectRows` is a `flatMap`.** `scalarRow` stays — it is an exported, tested seam — and its
   doc no longer implies a component ever consumes `ScalarRow | null`. None does.
4. **`LineBase`.** The four line arms each redeclared `depth` and `label` with their own JSDoc.
5. **Two pieces of node identity the wire carried are no longer discarded.** `ElidedLine` kept only
   `valueKind` and threw away the `ElidedValue`, while its sibling `AliasLine` kept the whole
   `AliasView`; it now carries the `ElidedValue` and the pane reads `line.elided.kind`.
   `LineLabel`'s `unnamed` arm dropped `FieldView.key_node`, so a mapping entry with a non-scalar
   key could not be addressed at all; it now carries `keyNode`. **Phase 2 addresses a line in order
   to edit it**, so a projection that silently drops the identity it was handed is a real future
   cost. Nothing else was added speculatively.
6. **Unmodelled entries got a display type, and it closed a real blank `<dt>`.** `UnknownEntry` was
   the one thing the pane passed through raw, so the component reached into wire fields and decided
   `{#if entry.key === null}` in markup. Underneath that was a defect: `entry.key` was printed raw,
   so an entry whose key is the **empty string** rendered a blank `<dt>` — the exact "a row with
   nothing in it is indistinguishable from a row that failed to render" failure `ScalarDisplay.empty`
   exists to prevent everywhere else in this pane. `describeUnknown` now answers an `UnknownRow`
   whose `key` is `named` / `empty` / `unnamed`, the `empty` arm reuses `browser.detail.emptyText`,
   and all three arms are tested. `MatchDetail.unknown` and `VariableDetail.unknown` are
   `readonly UnknownRow[]`.
7. **One spelling of the exhaustiveness idiom.** `detail.test.ts` had a runtime no-op
   `assertNever<T extends never>()` — no-op calls emitted into the test bundle, and a name
   overwhelmingly associated with the *throwing* `default:` idiom, so somebody would eventually call
   it expecting a throw and get a silent fallthrough. `codes.test.ts`'s type-only
   `Missing`/`ExpectNever` pair, used thirteen times, moved to `src/lib/i18n/exhaustive.ts` (types
   only, zero runtime) and both files import it. The thirteen usages are untouched.
8. **`hasDiscovery`.** The pane decided `detail.discovery.length > 0 || detail.searchTerms !== null`
   in markup — a compound predicate of exactly the shape `hasOptions` existed to keep out. It is a
   tested function now. The three single-list `{#if X.length > 0}` checks were left alone.
9. **One built-key test deleted**, the only test removed. `scripts/lint/built-translation-keys.test.ts`
   already runs that scan over **every** `.svelte` file under `src/` with a non-vacuity guard and
   `formatBuiltKeyFindings` in its message; the copy named one file and asserted `toEqual([])`, so it
   was strictly weaker. The accessor-name scan, the `item`-branch check and the `.depth-N` check
   stayed — those have no precedent elsewhere.
10. **Two CSS fixes.** `--font-mono` is a token in `src/app.css` instead of three byte-identical font
    lists (`DetailPane`'s `.key` and `.source`, `SnippetList`'s `.trigger`); the typeface carries
    meaning here — it is the "this is what the document holds" signal — so it is stated once. And the
    `.depth-0` … `.depth-5` ladder moved out of `DetailPane.svelte`'s scoped `<style>` into
    `src/app.css` unscoped: **Svelte scopes component styles**, so those rules compiled to
    `.depth-3.svelte-<hash>` and no other component could use them; a second pane needing
    indentation would have got a second private ladder and a second private constant.
    `MAX_INDENT_DEPTH` is documented as `src/app.css`'s contract and the integrity test reads that
    file. `dist/assets/index-*.css` was inspected and holds the six rules un-suffixed.
11. **The legacy `word` fixture override is gone.** `MatchOverrides` offered `word?: string | null`
    *and* the general `options?:`, plus a merge block reconciling them — two ways to set one field
    with no type preventing a contradiction. Six call sites in `selection.test.ts` and
    `search.test.ts` now write `options: { word: … }`.
12. **One misleading JSDoc corrected.** `detailFieldKey`'s comment justified living outside
    `codes.ts` by citing `src-tauri/src/dictionary_contract.rs`. That check filters on the **key
    prefix** `code.`, not on the file: a builder in `codes.ts` returning `browser.detail.field.*`
    would pass `cargo test` unchanged. The placement is right for a different reason — `codes.ts`
    bridges **Rust** codes to sentences, `DetailFieldName` is the frontend's own vocabulary with no
    Rust twin, and `browser/notices.ts`'s `selectionNoticeKey` is the precedent.

### 15.2 A noted risk, deliberately not acted on

**`src/lib/i18n/index.ts` imports values from `src/lib/browser/`.** It imports `detailFieldKey` and
`optionGroupKey` from `browser/detail.ts` and `selectionNoticeKey` from `browser/notices.ts` as
**values**, while those modules import from `i18n/` only with `import type`. There is therefore no
module cycle today, and it is `import type` — erased at compile time — that is the only reason.
**The first time a browser model needs a runtime value from the i18n layer, this becomes a real
cycle**, and Vite will resolve it in whatever order it resolves it in.

Restructuring it was considered and rejected for this pass: it is a layering decision about where a
frontend-only code's key builder belongs, not a cleanup, and item 12 above has just written down the
reasoning that any restructuring would have to argue against. It is recorded here so the next
edit that adds a runtime import in the other direction is not surprised.

### 15.3 What was not verified

**No window reading was taken for this pass.** Items 1, 6 and 10 change markup, and section 11's
technique needs a temporary probe compiled into `src-tauri/src/main.rs` and `src/main.ts`, a
hand-assembled and ad-hoc-signed bundle, and a synthetic configuration tree — which is not a cheap
reading, and the tree had to be left clean. What stands in for it is weaker and is named as such:
`svelte-check` type-checks the markup, including the new `{#each detail.options …}` and the
three-arm key choice; the emitted `dist/assets/index-*.css` was read and holds `--font-mono` and the
six un-suffixed `.depth-N` rules; and 425 tests pass. **None of that is a screen.** The `.depth-*`
move in particular is visually unverified — hole 6 now says so — and by this phase's own standard a
claim about the pane needs a reading, which the **next** change to these components should take.
