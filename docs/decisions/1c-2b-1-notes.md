# Phase 1c-2b-1 — the app's typed judgements

**What this sub-phase is.** The point at which a read-only browser starts saying things *about* a
file rather than only showing it. Three surfaces gained content and no command, no wire field and no
Rust line changed: `HazardKind` reached a screen, the parse diagnostics reached a screen, and the
sidebar stopped conflating *could not read this* with *have not read this*.

Everything below is frontend. `crates/espansoconfig-core` and `src-tauri/` are untouched;
`MatchView.blocking_hazard`, `MatchView.safely_editable`, `DocumentView.hazards`,
`DocumentView.diagnostics` and `DocumentView.parsed` were all already on the wire with no reader.

---

## 1. What was built, in one paragraph each

**`matchEditability()` in `src/lib/browser/detail.ts`**, and `MatchDetail.editability` beside it. It
reads a match's two editability fields into one of three answers — `unrestricted`, `blocked` with a
named `HazardKind`, `blockedUnnamed` — and `DetailPane.svelte` draws the second and third and
**nothing at all** for the first.

**`src/lib/browser/findings.ts`**, new: `describeFindings(DocumentView | null)` and
`hasFindings()`. One file's diagnostics and hazards, unioned, **aggregated** and ordered, rendered by
`SnippetList.svelte` under the search summary whenever the sidebar names one file. **Every file is
projected now, config profiles included** — the review's Medium 2; before it, a profile with broken
YAML was silent in every pane of this application.

**`SidebarRow.unreadable` in `src/lib/browser/sidebar.ts`**, fed by
`buildSidebar(documents, counts, unreadable)`, fed in turn by a `loadFailures` that now carries the
`DocumentId` beside the `IpcFailure`. Three count states where there were two, and a refused file is
no longer counted as *pending*.

**Eight dictionary keys in each language**, taking both files from 218 to 226, and **two existing
sentences reworded** after the review found one of them false.

---

## 2. Where a hazard belongs, and why there

A hazard is a fact about **bytes**, and the wire reports it at two scopes. The two scopes got two
homes, deliberately.

**A match's blocking hazard goes in the detail pane**, as one sentence under the file row. That is
where the reader is asking *"can I change this snippet?"*, and it is the only surface that has one
snippet in front of it. The snippet list already carries the `Not editable` badge for the same fact
— `MatchBadge::NotEditable` is pushed in `crates/espansoconfig-core/src/model/match_view.rs` when
`!view.safely_editable` — so the pane is not introducing the claim, it is supplying the **reason**
the badge withholds. A hazard *name* in a list row would be a second badge saying the same thing at
half the width.

**A file's hazards and diagnostics go in the snippet list**, not in the detail pane, and the reason
is decisive rather than aesthetic: **the file that most needs a diagnostic has no matches at all.**
The four deliberately invalid fixtures in
`crates/espansoconfig-core/tests/corpus/synthetic/invalid/` cross the boundary as a `DocumentView`
with `parsed: false`, an empty `matches` and a `ParseFailed` diagnostic — not as a refusal; that is
what `a_document_that_does_not_parse_crosses_as_a_view_not_as_an_error` in
`src-tauri/src/commands.rs` pins. Nothing in such a file can be *selected*, so the detail pane is
unreachable for it forever. Selecting the file in the sidebar is reachable, and the middle pane is
what that selection points at. The reading in section 7 shows the parse error on a screen for
exactly this file.

**The sidebar was rejected as a home for either.** A hazard is a sentence; the sidebar's rows are a
path and a number, and plan section 8.4's "never hide the file boundary" is about keeping those rows
about *files*. What the sidebar did gain is the one thing that is a property of a row: whether this
app failed to read it.

**Every file is projected, so every file can be asked.** The middle-pane argument only holds if the
middle pane can actually be pointed at any file, and until the review it could not: `open()` skipped
anything `holdsMatches()` refused, so a **config profile** had no `DocumentView` at all and
`scopedDocument` answered `null` for its sidebar row. A profile whose YAML is broken was therefore
silent in all three panes — the exact unreachability this section is about, for the one file kind
the placement argument had not been applied to. `holdsMatches()` now governs **counting and scope** and not projection: profiles project, contribute
no snippet count and no snippet-list row, and keep their `–` rather than gaining a `0` that would
invite the reader to expect snippets in them.

**"And no snippet-list row" is only true because a second guard was added.** The first version of
this fix left `scopedMatches()` alone on the assumption that a profile has no matches — and a
`config/*.yml` whose *content* carries match-file keys is projected as `DocumentShape::MatchFile`
**deliberately** (`crates/espansoconfig-core/src/model/document.rs`), so `view.matches` on such a
document is populated. The second review pass caught it: the list flat-mapped every view while the
sidebar total already excluded profiles, so the pane showed rows the total did not count. Both
branches of `scopedMatches()` ask `holdsMatches` now.

The question is asked of `kind` and not of `shape`, and the difference is the whole point: `kind` is
what espanso treats the file as — a fact about **where it lives** — and espanso does not load
snippets out of `config/`, whatever the file says. `shape` is what the content looks like, and the
core raises `ShapeDisagreesWithLocation` when the two differ. That diagnostic is now what the reader
sees in place of the rows, which is the placement argument of this section paying for itself: the
sentence explaining the empty list is reachable because profiles are projected.

### 2.1 The verdict field decides; the hazard field explains

`matchEditability()` reads `safely_editable` **first** and consults `blocking_hazard` only for the
reason. In Rust the two cannot disagree — `TriviaIndex::is_safely_editable` is *defined* as
`disqualifying_hazard(index, node).is_none()`, one function so that the answer and the reason cannot
drift — but they are two independent fields on the wire, and a model has to answer for the case
anyway.

The order was chosen so that the pane can never contradict the row two panes to its left: the badge
comes from `safely_editable` alone, so a pane refusing on the strength of `blocking_hazard` would
put "this app will not edit this snippet" beside a row with no `Not editable` badge. A hazard named
on a match the wire calls editable is not lost either — it is still in `DocumentView.hazards`, which
the middle pane lists for the file. `detail.test.ts`'s *"lets the verdict field decide when the two
fields disagree"* is the pin, and experiment C is the disabling proof.

---

## 3. The refusal is drawn; the permission is not

`unrestricted` renders **nothing**, and that is the sub-phase's central decision.

Phase 1 is read-only. A line saying *"this snippet can be edited safely"* is a promise about an
editor the reader cannot reach, and it is the same class of statement as presenting a plain scalar's
type (D2u) or 1c-2a's "shown as written" beside a value that was not shown: telling the user
something this project has not earned the right to say. A **refusal** is different in kind — the
mutation entry point really does refuse, by name, in
`crates/espansoconfig-core/src/patch/edit.rs` (`EditError::Refused`), and refusing is what this app
does today rather than what it plans to do.

Both halves are pinned. `detail.test.ts`'s *"draws the refusal and draws nothing for the
permission"* asserts the two `{#if}` arms are present **and** that the string `'unrestricted'` does
not appear anywhere in `DetailPane.svelte`. The second half is the one a later edit breaks by
"improving" the pane with a reassuring green line; experiment B shows it firing.

The wording follows the same rule, **and the first attempt at it did not.** The string said *"…it
contains {kind}"*, meaning the snippet; `TriviaIndex::disqualifying_hazard` returns a hazard flagged
on the match's node, on an **ancestor** of it, on a descendant of it, or — checked first of all —
one with **no node at all**, which disqualifies the whole document. So for an orphan hazard such as
`MultiDocumentStream`, and for any hazard above the match, "this snippet contains it" was simply
false. It reads *"This app will not edit this snippet: **this file** contains {kind}."* now, which is
true in every one of those four cases and parallels `code.diagnosticCode.hazard`. Found by the
string-versus-data sweep in section 6.2, not by the review — the review's Low 1 was about the
*unnamed* arm, and checking that one is what made this one visible.

`browser.detail.notEditableUnnamed` reads *"This app will not edit this snippet, and no reason was
given."* It said *"…it did not record which part of the file blocks it"* until the review's Low 1,
which is right: the only fact in evidence is that the verdict refuses. A refusal that one day is not
about a hazard at all — a policy refusal, or merely contradictory wire data — would have made the
invented explanation false.

---

## 4. What `describeFindings()` decides, and what it refuses to decide

**A hazard is named once.** Every hazard arrives twice: once in `DocumentView.hazards` (the distinct
set, sorted) and once per occurrence as a `Hazard` diagnostic — `document.rs` builds the first with
`distinct_hazards(trivia)` and the second in a loop over `trivia.hazards()`. Rendering both lists
prints every hazard two ways, as a noun phrase and as a sentence. So the `Hazard` diagnostics are
kept out of the sentence list and their kinds are **unioned** into the hazard list rather than
compared with it: a kind the diagnostics name and the summary somehow does not is added, so a wire
disagreement is visible instead of swallowed. The union is a `Set` seeded from the summary, which is
the review's Low 2 — the first version spread the summary straight through and deduplicated only
what it appended, so a summary that repeated a kind would have produced two `{#each}` rows keyed on
one value, which Svelte refuses **at run time**, in a component no test renders.

**A repetition is counted; a diagnostic is never dropped.** This is the review's Medium 1, and the
first version of this module got it wrong in exactly the way this sub-phase exists to avoid. It kept
the first diagnostic of each code and discarded the rest, on the grounds that they render as the same
sentence — which they do, and **twenty `KeyNotAccountedFor` diagnostics at twenty different keys then
produced one line saying "espansoConfig neither read nor recorded one key of this file"**. One key.
That is a false statement about a real configuration, printed by the sub-phase built to stop the app
making false statements.

The rule is **aggregation** now, and it needs two identities rather than one:

- `diagnosticIdentity(code)` — `JSON.stringify` of the code alone. It decides which occurrences
  **share a line**, because it is exactly what decides which occurrences read the same.
- `occurrenceIdentity(diagnostic)` — the code, the span, the node and the path. It decides what is a
  **distinct finding**. Two records equal in all four are one finding reported twice, which the wire
  is not supposed to produce and which is the only thing still collapsed anywhere in this module.

The line then carries `occurrences` and the pane says *"in N places"* through `plural.ts` when
`repeated` is true. Printing the sentence N times instead was considered and rejected: without a span
on screen the repetitions are byte-identical, so twenty of them tell the reader nothing the count
does not and push everything below off the pane. **A located line per occurrence would be strictly
better** and needs a line number this pane does not have; hole 3.

Deduplicating on the *variant name* rather than the whole code remains wrong for a second reason and
is still pinned: it would show one of two `RepeatedKey` diagnostics naming different keys and hide
the other. Experiments D, Q and R are the three disabling proofs.

**Ordering is the projection's.** Hazards in the order the core sorted them, diagnostics in source
order. Nothing here sorts, ranks by severity or promotes `ParseFailed` to the top — a severity order
is a judgement this project has not made, and inventing one here would be a second thing to keep in
step with Rust.

**Not decided here, deliberately: which diagnostics are about the selected match.** `Diagnostic.node`
and `MatchView.source_node` are both `NodeId`s and an equality filter would correlate *some* of them
— but a diagnostic raised at a child node of a match would not match, and a partial correlation
presented as "this snippet's problems" is worse than none. Hole 4 below.

---

## 5. `loadFailures` carries the identity rather than recovering it

`browser.loadFailures` was `readonly IpcFailure[]`. It is now `readonly LoadFailure[]`, each entry a
`{ document: DocumentId; failure: IpcFailure }`.

Two ways of recovering the identity from the failure alone were considered and rejected:

- **Matching `IoError.path` against `DocumentSummary.path` is unsound.** Both are `WirePath`
  renderings (`crates/espansoconfig-core/src/wire.rs`): a byte no encoding can name arrives as
  `U+FFFD`, so two different files on disk can produce one display string. The whole reason
  `WirePath` exists is that the string is *for display* and does not necessarily name the file.
- **Not every code carries a path.** `noWorkspaceOpen` and `menuUnavailable` carry none, and a
  future refusal need not either.

The loop in `open()` that meets the refusal already holds the `DocumentId`. It keeps it. That is
strictly more information than the sidebar could have recovered and costs one field.

**`pending` also changed meaning slightly, and correctly.** It means "this total is about to grow".
A refused file makes that false, so it is excluded; the fact is on the row as `unreadable` instead.
Experiment G shows the three tests that fire when it is put back.

---

## 6. The strings, and where the lint cannot see them (R31)

Eight keys per language, 218 → **226**. `en.json` is still the schema.

| Key | English |
|---|---|
| `browser.sidebar.unreadable` | Could not be read |
| `browser.list.notes.label` | What this app noticed in this file |
| `browser.list.notes.diagnostics` | What this app noticed in this file: |
| `browser.list.notes.hazards` | This file contains parts the visual editor will not change: |
| `browser.list.notes.occurrences.one` | in {count} place |
| `browser.list.notes.occurrences.other` | in {count} places |
| `browser.detail.notEditable` | This app will not edit this snippet: this file contains {kind}. |
| `browser.detail.notEditableUnnamed` | This app will not edit this snippet, and no reason was given. |

Two **existing** sentences were also reworded, both of them `document_index`-carrying diagnostics
that this sub-phase put on a screen for the first time:

| Key | Was | Is |
|---|---|---|
| `code.diagnosticCode.additionalDocumentNotProjected` | Espanso reads only the first document of a file, so document {document_index} **is shown** but not interpreted. | Document {document} was not interpreted, because espanso reads only the first document of a file. |
| `code.diagnosticCode.emptyDocument` | Document {document_index} of this file has no content. | Document {document} of this file has no content. |

None of the eight is identical across the two files, so the untranslated-value exception list in
`dictionaries.test.ts` is unchanged at nine entries.

**`plural.ts` gained a third pair**, `occurrenceCountKey`, which is what the pair-selector design
anticipated: two dictionary keys and one function, and no key built at a call site.

A hazard *tally* — "a merge key, in 3 places" — was considered again and is still not done: it needs
a zero-occurrence arm for a kind the summary lists and the diagnostics do not, and arithmetic across
two wire fields. Not showing a number is not a lie. Hole 3.

### 6.2 Every new string checked against the data behind it

The review's High 1 was a sentence claiming something the app does not do, so all eight new strings
and the two reworded ones were read against the wire field they render. Recorded because the check
found a second defect the review did not:

| String | The data | Verdict |
|---|---|---|
| `browser.sidebar.unreadable` | an entry on `loadFailures`, from a refused `get_document` | true; the refusal's own reason is named in the block above the groups |
| `browser.list.notes.label` / `.diagnostics` | `DocumentView.diagnostics` minus the hazard-coded ones | true — these are what the projection noticed |
| `browser.list.notes.hazards` | `DocumentView.hazards` | true: hazards come from this file's own trivia index, and `is_safely_editable` refuses at, above and below each one |
| `browser.list.notes.occurrences.*` | distinct `(code, span, node, path)` records | true; a record with no span is one "place" and never says so, because `repeated` is false at a count of one |
| `browser.detail.notEditable` | `blocking_hazard` | **false as first written** — "it contains {kind}" is untrue for an ancestor hazard and for an orphan one. Reworded to "this file contains"; see section 3 |
| `browser.detail.notEditableUnnamed` | `safely_editable === false` alone | false as first written (review Low 1); reworded to claim only the verdict |
| `code.diagnosticCode.additionalDocumentNotProjected` | a span, recorded and not descended into | **false as written** (review High 1) — nothing shows the later document, and the raw-YAML viewer is 1c-2b-2's |
| `code.diagnosticCode.emptyDocument` | `document_index`, zero-based | not false, and off by one (review Medium 3) |

One string that had no caller before this sub-phase still has none, deliberately:
`code.diagnosticCode.hazard`. Its sentence is the per-occurrence form, and the file-level list renders
`tHazard` instead; `dictionary_contract.rs` requires the key to exist regardless.

### 6.3 R31 — the blind spots, by name

`scripts/lint/hardcoded-strings.ts` sees `.svelte` **markup** and nothing else. The run is clean and
that clean run is **not** evidence for these, each of which was read by eye instead:

1. **`<script>` bodies of the three components touched.** `SnippetList.svelte` gained a `$derived`
   and three imports; `DetailPane.svelte` gained one import; `Sidebar.svelte` gained nothing. None
   holds a string literal, checked by reading.
2. **`.ts` constants in the six modules touched.** `findings.ts` holds one literal object
   (`NOTHING`) and no string; `detail.ts`'s new code holds the three arm names `'unrestricted'`,
   `'blocked'`, `'blockedUnnamed'`, which are **discriminants**, not prose; `sidebar.ts` and
   `workspace.svelte.ts` gained no literal; `codes.ts` gained
   `ONE_BASED_DISPLAY_OPERANDS`, whose two strings are a **wire field name** and a
   **placeholder name**, neither of which is prose; `plural.ts`'s new function holds two dictionary
   keys, which is what that module exists to hold.
3. **`{'literal'}` in markup.** An expression is exactly what the scanner wants to see in that
   position, so a literal wrapped in braces passes. None was written; checked by reading.
4. **Props.** Text arriving through a component prop is invisible to the scanner. The three
   components take one prop each, `browser`, unchanged.
5. **The `{#each}` keys and CSS class names** — `notes`, `blocked`, `warn` — which are markup the
   scanner deliberately ignores and which never reach a screen as words.
6. **The `aria-label` on the notes block** is an attribute the scanner *does* watch, and it holds
   `t('browser.list.notes.label')`. That one is mechanically covered; it is listed here so the list
   is a list of what was checked rather than of what was assumed.

`scripts/lint/built-translation-keys.ts` covers the other half — no `t(` in any component takes a
computed key — and experiment M shows it firing on `SnippetList.svelte` specifically.

**What neither can see, and what nothing in this repository can see: whether a string is true.**
Experiment P below is the demonstration.

---

## 7. R32: what was seen in a running application

### 7.1 The setup

1c-1's technique (`1c-1-notes.md` section 10.3), unchanged: `npm run build && cargo build -p
espansoconfig --features custom-protocol`, the binary placed in a hand-assembled
`espansoConfig.app` (`Contents/MacOS` + `Info.plist`), ad-hoc code-signed, launched through
LaunchServices with

```sh
open --env "XDG_CONFIG_HOME=<scratch>/xdg" --env "HOME=<scratch>/home" --stdout <log> <scratch>/espansoConfig.app
```

and a **temporary probe** — a `render_probe` command in `src-tauri/src/main.rs` and an async block in
`src/main.ts` that reports the three panes' `getBoundingClientRect()` and `innerText`, clicks sidebar
rows and snippet rows, and ends by printing `PROBE-END` so that a run cut short by WebKit's
background-timer throttling is distinguishable from one that finished. (1c-2a learned that the hard
way: *a probe that stops early looks exactly like a probe that finished.* Every reading quoted below
comes from a run that printed `PROBE-END`; one did not, and section 7.7 says what happened to it.)

**The readings were taken twice**: once as the sub-phase ended, and again after the review round,
because five of the seven fixes change what is on a screen. This section is the **second** set. The
rule is the project's own — *a claim about a screen needs a reading of a screen, re-taken after any
change to a component* — and it applies to a reworded string exactly as it applies to markup.

**The configuration it read was synthetic and hand-written for this run**, seven files under
`<scratch>/xdg/espanso`, every byte of it neutral:

- `match/base.yml` — three snippets, **two of them with no trigger**, which is the two-occurrence
  case the review's Medium 1 is about;
- `match/hazards.yml` — an **anchor definition**, an **alias reference** in one snippet's `replace`,
  a **repeated key** in another, and a third snippet with nothing wrong with it;
- `match/broken.yml` — **invalid on purpose**: an unclosed single-quoted scalar, the shape of
  `crates/espansoconfig-core/tests/corpus/synthetic/invalid/unclosed-quote.yml`;
- `match/locked.yml` — valid, at mode `000`, so `get_document` refuses with `io / PermissionDenied`.
  It had to be a *permission* failure: a file that does not parse crosses as a view, not as an
  error, so invalid YAML never reaches `loadFailures`;
- `match/options.yml` — one snippet exercising all four option groups, a two-item `search_terms`, a
  `choice` variable with a nested `params.values` list, and an unmodelled key holding a mapping;
- `match/streams.yml` — **a multi-document stream**, added for the review round: three documents, so
  the wire raises `AdditionalDocumentNotProjected` at indices 1 and 2 and the display has to say 2
  and 3;
- `config/default.yml` — **a profile whose root is a list**, also added for the review round, so it
  raises `RootIsNotAMapping`. It is the file Medium 2 is about: a profile is projected now, so its
  row is selectable and its diagnostic reachable.

The owner's real configuration was never opened: `XDG_CONFIG_HOME` is the first candidate
`resolve_config_dir()` probes and `HOME` was overridden on every run. Nothing quoted below comes
from it.

Both patched files were restored from copies taken before the edit; `git status --short` shows
neither modified, `rg render_probe` over `src`, `src-tauri/src` and `scripts` finds nothing, `dist/`
was rebuilt from the restored source, and every command in section 9 was re-run afterwards.

Geometry, identical in every run and in both languages: viewport `1180x728`,
`nav.sidebar x=0 y=44 w=268 h=645`, `section.list x=268 w=375`, `section.detail x=644 w=536`.

### 7.2 The sidebar — the conflation, fixed on a screen

English, `nav.sidebar` `innerText`, `<scratch>` elided:

> All / 7 / Some files could not be read, so this total counts only the files that were. / The file
> `<scratch>/xdg/espanso/match/locked.yml` could not be read. / FILES / match/base.yml / 3 /
> match/broken.yml / 0 / match/hazards.yml / 3 / **match/locked.yml / Could not be read** /
> match/options.yml / 1 / match/streams.yml / 0 / PROFILES / **config/default.yml / –**

and in Spanish:

> Todo / 7 / No se han podido leer algunos archivos… / ARCHIVOS / … / **match/locked.yml / No se ha
> podido leer** / … / match/streams.yml / 0 / PERFILES / **config/default.yml / –**

**The profile still shows `–` although it is now read.** That is the deliberate half of Medium 2's
fix: it is projected, and a `0` beside it would say the file was read and holds no snippets, which
invites the reader to expect that it could hold some.

**Those two rows are the whole of item 3, side by side on one screen.** `locked.yml` says *Could not
be read* in words; `config/default.yml` still shows `–`. Before this sub-phase both were `–` with
the tooltip "Not read yet".

The `title` of every count, both languages:

```
All                → "7 snippets"     → "7 fragmentos"
match/base.yml     → "3 snippets"     → "3 fragmentos"
match/broken.yml   → "0 snippets"     → "0 fragmentos"
match/hazards.yml  → "3 snippets"     → "3 fragmentos"
match/options.yml  → "1 snippet"      → "1 fragmento"
match/streams.yml  → "0 snippets"     → "0 fragmentos"
config/default.yml → "Not read yet"   → "Aún sin leer"
```

The refused row has **no `title` at all**, which is the point: it is visible text, so a reader who
never hovers and a screen reader that skips an `aria-hidden` span both get it. `1 snippet` /
`1 fragmento` is still singular, so 1c-1's plural fix is still on a screen.

### 7.3 The middle pane — the diagnostics and the hazards

`match/hazards.yml` selected, English, `section.list` `innerText`:

> Search snippets / 3 of 3 / **What this app noticed in this file:** / The key “replace” holds an
> alias, which is not the shape espanso expects there. / This snippet has nothing to insert. It
> needs one of replace, form, markdown, html or image_path. / The key “replace” appears more than
> once in the same block. / **This file contains parts the visual editor will not change:** / an
> anchor definition / an alias reference / a key that appears twice in one block / :hi / Alias
> reference / ⌗Not editable / :dup / Repeated key / ⌗Not editable / :plain / Ordinary snippet

and in Spanish:

> Buscar fragmentos / 3 de 3 / Lo que esta aplicación ha detectado en este archivo: / La clave
> «replace» contiene un alias, que no es la forma que espanso espera ahí. / Este fragmento no tiene
> nada que insertar. … / La clave «replace» aparece más de una vez en el mismo bloque. / Este
> archivo contiene partes que el editor visual no va a modificar: / la definición de un ancla / una
> referencia a un alias / una clave que aparece dos veces en un mismo bloque / …

Four things there are the phase's claims, seen rather than assumed:

- **`tDiagnostic` and `tHazard` have callers on a screen**, in both languages. They were 32 strings
  with no caller at all when this sub-phase started;
- **three hazards, each named once.** The `Hazard` diagnostics that would have said the same three
  things again as sentences are not in the list above them. That is section 4's union-and-filter,
  visible;
- **the diagnostic operands are interpolated and localized**: `“replace”` is the file's own key
  text, and `an alias` / `un alias` came out of the `code.valueKind.*` namespace through
  `ENUM_OPERAND_NAMESPACES` rather than as the raw Rust identifier `Alias`;
- **the badges agree with the pane**: `⌗Not editable` on `:hi` and `:dup`, and not on `:plain`.

`match/broken.yml` selected — the file with no matches, which is the case the placement argument
rests on:

> Search snippets / 0 of 0 / What this app noticed in this file: / **This file is not valid YAML.
> Reading stopped at line 4, column 13.** / There are no snippets here.

> Buscar fragmentos / 0 de 0 / … / **Este archivo no es YAML válido. La lectura se detuvo en la
> línea 4, columna 13.** / Aquí no hay ningún fragmento.

**`config/default.yml` selected — the review's Medium 2, on a screen.** Before the fix this row
selected nothing and the pane said nothing at all:

> Search snippets / 0 of 0 / What this app noticed in this file: / **The top level of this file is a
> list rather than a set of keys, so it holds no espanso settings.** / There are no snippets here.

> Buscar fragmentos / 0 de 0 / … / **El nivel superior de este archivo es una lista en lugar de un
> conjunto de claves, así que no contiene ninguna opción de espanso.** / Aquí no hay ningún fragmento.

**`match/base.yml` selected — the review's Medium 1, on a screen.** Two snippets in it have no
trigger, so the wire raises `MatchHasNoTrigger` twice:

> Search snippets / 3 of 3 / What this app noticed in this file: / This snippet has no trigger. It
> needs one of trigger, triggers or regex. **in 2 places** / :sig / Signature / No trigger / Missing
> trigger one / No trigger / Missing trigger two

> Buscar fragmentos / 3 de 3 / … / Este fragmento no tiene disparador. Necesita uno de trigger,
> triggers o regex. **en 2 sitios** / …

One sentence, and the sentence carries the two. Before the fix this line was identical and said
nothing about there being two, which for `KeyNotAccountedFor` — "espansoConfig neither read nor
recorded **one key** of this file" — would have been a false sentence rather than an incomplete one.

**`match/streams.yml` selected — the review's High 1 and Medium 3 together.** The file holds three
YAML documents, so the wire carries `document_index` 1 and 2:

> Search snippets / 0 of 0 / What this app noticed in this file: / **Document 2 was not interpreted,
> because espanso reads only the first document of a file.** / **Document 3 was not interpreted,
> because espanso reads only the first document of a file.** / The top level of this file is a single
> value rather than a set of keys, so it holds no espanso settings. / This file contains parts the
> visual editor will not change: / several YAML documents in one file / There are no snippets here.

> Buscar fragmentos / 0 de 0 / … / **El documento 2 no se ha interpretado, porque espanso solo lee el
> primer documento de un archivo.** / **El documento 3 no se ha interpretado, porque espanso solo lee
> el primer documento de un archivo.** / … / varios documentos YAML en un mismo archivo / …

Wire indices 1 and 2, displayed as 2 and 3 — one-based, in both languages — and **no sentence
anywhere says the later documents are shown**. It also shows the two operands of one code producing
two lines rather than being collapsed, which is section 4's grouping rule seen from the other side.

`match/base.yml`'s block above is also the case where the hazard heading must **not** appear — it has
diagnostics and no hazards — and it does not.

### 7.4 The detail pane — the refusal, and its absence

`:hi`, the snippet whose `replace` is an alias, English:

> File / match/hazards.yml / **This app will not edit this snippet: this file contains an alias
> reference.** / TRIGGER / Trigger form: One trigger / Trigger / :hi / Written between double quotes
> / CONTENT / Content form: No content / LABEL AND SEARCH / Label / Alias reference / ENTRIES THIS
> APP DOES NOT MODEL / 1 entry was recorded and left untouched. / replace / holds an alias, which
> this pane does not show / This key holds an alias, which is not the shape espansoConfig models, so
> the entry was recorded and is kept exactly as the file writes it.

Spanish: *Esta aplicación no editará este fragmento: **este archivo** contiene una referencia a un
alias.* — the reworded string of section 3, seen in both languages rather than assumed from a diff.

`:plain`, in the same file, one click later:

> File / match/hazards.yml / TRIGGER / Trigger form: One trigger / Trigger / :plain / Written
> between double quotes / CONTENT / Content form: Replacement text / Replacement text / Nothing here
> blocks the editor. / Written between double quotes / LABEL AND SEARCH / Label / Ordinary snippet

**No sentence about editing at all.** Both halves of section 3 on two screens one click apart: the
refusal drawn, the permission not drawn.

Two things worth noting from the first block. The refusal appears on a snippet whose hazard is
*inside* it while its two siblings in the same file are judged independently — the anchor definition
at the top of the file did not blanket the whole document. And `replace` holding an alias produced
**both** a blocking hazard and an unmodelled entry, so the two 1c-2a surfaces and the new one are
visible together and do not contradict each other.

### 7.5 The stale 1c-2a evidence, re-taken

`PROGRESS.md`'s Next action opens by warning that `82ad7c5` changed `DetailPane.svelte` and moved
the `.depth-*` ladder into `src/app.css` with no reading re-taken. Three things were therefore
unverified. All three were read. **This subsection is from the first set of readings**, before the
review round — nothing in the review's seven fixes touches the option groups, the bullets or the
indentation ladder, and the two `DetailPane.svelte` edits since (a reworded string in each refusal
arm) are re-read in section 7.4.

`:opt` in `match/options.yml`, English:

> File / match/options.yml / TRIGGER / … / LABEL AND SEARCH / Label / Every option group / Search
> terms / **•** / alpha / **•** / beta / **OPTIONS / Word boundary / Whole word / on / Ambiguous /
> Capital letters / Follow the case that was typed / true / Ambiguous / Insertion method / Insertion
> mode / clipboard / Other / Paragraph / false / Ambiguous** / VARIABLES / pick / Read as: Choice /
> Type / choice / Parameters / values / a list / **•** / one / **•** / two / 1 entry was recorded and
> left untouched. / unmodelled_here / holds a set of keys, which this pane does not show /
> espansoConfig has no field for this key, so the entry was recorded and is kept exactly as the file
> writes it.

Spanish: *OPCIONES / Límites de palabra / Palabra completa / on / Ambiguo / Mayúsculas / Seguir las
mayúsculas que se escriban / true / Ambiguo / Método de inserción / Modo de inserción / clipboard /
Otras / Párrafo / false / Ambiguo / VARIABLES / pick / Se lee como: Elección / … / una lista / • /
one / • / two / 1 entrada se registró y se dejó intacta. / unmodelled\_here / contiene un conjunto
de claves, que este panel no muestra / …*

- **All four option groups render through the one `{#each}`** that replaced four `{#if}` blocks at
  `82ad7c5`, with the right rows under the right headings and in both languages;
- **the unmodelled entry's three-arm key label works**: `unmodelled_here` through the `named` arm
  here, and `replace` through it in section 7.4. (The `empty` and `unnamed` arms were not on a
  screen — hole 6.);
- **`word: on` is still the two characters `on` with the ambiguity flag beside it**, and
  `capitalize`-style values still are not resolved. D2u, unchanged.

**And the `.depth-*` question, answered properly for the first time.** 1c-2a could say only that the
rules were present and un-suffixed in `dist/assets/*.css`, which experiments N and P had already
shown is not evidence that a rule is *used*. The probe read `getComputedStyle()` of the rendered
lines instead:

```
line depth-0 svelte-11my561 : padding-inline-start 0px
line depth-0 svelte-11my561 : padding-inline-start 0px
line depth-0 svelte-11my561 : padding-inline-start 0px
line depth-1 svelte-11my561 : padding-inline-start 14px
line depth-1 svelte-11my561 : padding-inline-start 14px
```

14px is `1rem` at the shell's 14px root, which is `.depth-1`'s declared value in `src/app.css`. The
depth class carries **no** Svelte hash suffix while the sibling `svelte-11my561` class does, which
is the mechanism working exactly as the move intended: the ladder is global and the markup reaches
it. **`.depth-0` and `.depth-1` are confirmed applied; `.depth-2` … `.depth-5` were not on this
screen** (hole 7).

### 7.6 What these readings do not establish

- **No pixels.** `innerText` and `getComputedStyle` are what WebKit computed, not what was painted.
  A pane white-on-white, a `z-index` accident or a clipped column would read identically. The
  machine's screen-recording permission is still what stands between this phase and a screenshot.
  `getComputedStyle` narrows this for indentation specifically and for nothing else.
- **Nothing establishes that the Spanish is Spanish.** `dictionaries.test.ts` establishes
  non-identity. Eight more values were added and two rewritten, read aloud by one non-native reader,
  which is not the bilingual review 1c-1 and 1c-2a both asked for.
- **`blockedUnnamed` was never on a screen.** It cannot be provoked from a file: Rust derives both
  fields from one call, so producing it needs a hostile wire. Unit-tested only (hole 5).
- **`EmptyDocument` was never on a screen either**, so the one-based conversion was seen at wire
  indices 1 and 2 and not at 0. `codes.test.ts` covers index 0 in both languages, and the reading's
  three-document file produced a `RootIsNotAMapping` for its first document rather than an
  `EmptyDocument`.
- **The reading is seven files.** No package, no `_`-prefixed file, no search over a findings block,
  no notice, and no configuration large enough to make a diagnostics list long.

### 7.7 The third reading: a profile that looks like a match file

**Taken because a rendering changed.** The second pass's Medium removes rows from the middle pane for
one input, which is a claim about a screen. The Low changes no rendering at all — the typed table's
only non-empty rows carry the same two operands the one-entry version did, and the suite pins the
output for every variant — so nothing was re-read for it, said here rather than skipped silently.

`config/default.yml` was rewritten as a profile whose **content** is a match file: a root `matches:`
holding two snippets. English, `<scratch>` elided:

> **All / 7** / … / PROFILES / **config/default.yml / –**
>
> Search snippets / **7 of 7** / :sig / Signature / No trigger / Missing trigger one / No trigger /
> Missing trigger two / :hi / Alias reference / ⌗Not editable / :dup / Repeated key / ⌗Not editable /
> :plain / Ordinary snippet / :opt / Every option group / ⌗Variables

and with that profile selected:

> Search snippets / **0 of 0** / What this app noticed in this file: / **The folder this file is in
> and its content disagree: the content looks like a snippet file.** / There are no snippets here.

Spanish, same three readings: *Todo / 7 / … / config/default.yml / – *; *Buscar fragmentos / 7 de
7 / …*; and *Buscar fragmentos / 0 de 0 / … / **La carpeta en la que está este archivo y su contenido
no concuerdan: el contenido parece un archivo de fragmentos.** / Aquí no hay ningún fragmento.*

Three things, seen rather than assumed:

- **`:inprofile` and `:also` are in neither list.** The "All" scope shows seven rows and the sidebar
  total says seven; before the fix it would have shown nine against a total of seven, which is what
  experiment Z reproduces as `[ 90, 91, 10, 11, 20 ]` against 3;
- **the profile's own scope is `0 of 0`**, not two rows;
- **the reader is told why.** `ShapeDisagreesWithLocation` occupies the space the rows would have
  taken, in both languages — and it is on screen only because profiles are projected, which is
  section 2's placement argument returning the favour to the fix that broke it.

### 7.8 The run that did not finish, and what it says about the instrument

The first English run of the review round printed readings 1 through 5 and **stopped before
`PROBE-END`** — one long chain of clicks and `setTimeout`s in a window that spends most of its life
occluded, which is exactly the throttling 1c-2a wrote down. The detail-pane readings were re-taken as
a separate short run rather than inferred from the partial one.

A second instrument lesson, new: with `--features custom-protocol` **the frontend is compiled into
the binary**, so `npm run build` alone changes nothing a launched bundle reads. One run produced
output identical to the previous one, down to steps that had been deleted from the probe, because the
copied binary still embedded the old `dist`. `cargo build` has to follow every `npm run build`. A
reading that is silently of the *previous* build is worse than one that stops early, because it looks
complete.

---

## 8. The disabling experiments

Each break was applied to the working tree, the relevant suite run, and the file restored from a
copy. **An oracle that cannot disagree is not an oracle**, so the three that did *not* fire are
recorded with the same weight as the twenty-five that did. A–O2 are the sub-phase's; Q–Y are the
first review round's, and one of them is a *demonstration that a check the reviewer called
unfalsifiable really is*; Z–AB are the second pass's.

| # | The break | What fired |
|---|---|---|
| A | `DetailPane.svelte` renders `detail.editability.hazard` instead of `tHazard(...)` — the raw Rust identifier on screen | `detail.test.ts` → *contains a call to tHazard somewhere in its source* |
| B | The pane draws a line for the `unrestricted` arm too | `detail.test.ts` → *contains the refusal arms in its source and the permission arm nowhere* |
| C | `matchEditability()` consults `blocking_hazard` before `safely_editable` | `detail.test.ts` → *lets the verdict field decide when the two fields disagree* |
| D | `diagnosticIdentity()` returns `diagnosticCodeName(code)` — dedup on the variant name | `findings.test.ts` → *keeps two diagnostics whose operands differ* **and** *gives two codes that read the same one identity…* (2 failures) |
| E | `describeFindings()` stops filtering `Hazard` diagnostics out of the sentence list | `findings.test.ts` → *does not also render them as diagnostics*, *keeps a hazard the diagnostics name…*, and the grouping case (3 failures) |
| F | The hazard union stops appending a kind only the diagnostics name | `findings.test.ts` → *keeps a hazard the diagnostics name and the summary does not* |
| G | `buildSidebar` counts a refused file as `pending` again | `sidebar.test.ts` → *is not waited for: nothing is coming*; `workspace.test.ts` → 2 more (3 failures) |
| H | `buildSidebar` ignores the `unreadable` set entirely | `sidebar.test.ts` + `workspace.test.ts` → 5 failures, including *is marked on its own row…* |
| I | `scopedDocument` returns `null` for a document with no matches | `workspace.test.ts` → *is the projection even when that file holds no matches at all* |
| J | `browser.list.notes.hazards` deleted from `es.json` only | `dictionaries.test.ts` → 3 failures, including *are exactly equal, read from the files* |
| K | `browser.sidebar.unreadable` in `es.json` left byte-identical to the English | `dictionaries.test.ts` → *fires when a Spanish value was left byte-identical…* |
| L | The hazards heading written as an English literal in `SnippetList.svelte` markup | `hardcoded-strings.test.ts` → *SnippetList.svelte has no literal user-facing text in its markup* |
| M | The same heading rendered as `t(hazardHeadingKey())` — a built key | `built-translation-keys.test.ts` → *SnippetList.svelte hands t() a written key, never a built one* |
| O1 | `SnippetList.svelte` renders `{hazard}` instead of `{tHazard(hazard)}` | `findings.test.ts` → *contains a call to tHazard somewhere in its source* |
| O2 | The pane assembles the findings from `browser.scopedDocument.{diagnostics,hazards}` itself | `findings.test.ts` → *contains no source reading the wire fields the model exists to fold* |
| Q | `describeFindings()` drops a repeated occurrence instead of counting it — the defect the review found, put back | `findings.test.ts` → 4 failures, *accounts for every distinct finding the document holds* among them |
| R | `occurrenceIdentity()` returns the code alone, so the two identities coincide again | `findings.test.ts` → 5 failures, including *separates the sentence identity from the finding identity* |
| S | The hazard union spreads the summary through instead of seeding a `Set` | `findings.test.ts` → *names a kind once even when the summary itself repeats it* |
| T | `localizedOperands()` emits `document_index` unchanged instead of `+ 1` | `codes.test.ts` → *count documents from one rather than from zero* in both locales (2 failures) |
| U | `emptyDocument` in `en.json` left spelling the wire name `{document_index}` | `codes.test.ts` → *render every diagnostic in en with no gap left in the sentence*; `dictionaries.test.ts` → *agree between the two locales* (3 failures) |
| V | `open()` skips a document `holdsMatches()` refuses, as before the review | `workspace.test.ts` → *ends ready, with every file projected — profiles included* **and** *makes a profile's diagnostics reachable* (2 failures) |
| W | A projected profile contributes its `matches.length` to the sidebar counts | `workspace.test.ts` → *projects a profile without letting it into a count or the snippet list* |
| X | `SnippetList.svelte` renders `{line.occurrences}` — a bare number, no plural, no translation | `findings.test.ts` → *contains a call to tOccurrenceCount somewhere in its source* |
| Z | Both `holdsMatches` guards removed from `scopedMatches()` — the second pass's Medium, put back | `workspace.test.ts` → *keeps a match-shaped profile's matches out of the list the total counts*, with the disagreement in the message: `expected [ 90, 91, 10, 11, 20 ] to deeply equal [ 10, 11, 20 ]` against a sidebar total of 3 |
| AA | The `EmptyDocument` row deleted from `DIAGNOSTIC_DISPLAY_INDICES` | **`npm run check`** → *Property 'EmptyDocument' is missing in type …* at `codes.ts`, before any test runs. The point of the typed route: a forgotten variant is a compile error naming the variant |
| AB | The `EmptyDocument` row emptied to `{}` — present, and saying the wrong thing | `codes.test.ts` → 6 failures, including *count documents from one rather than from zero* in both locales and *render every diagnostic in … with no gap left in the sentence*, because the dictionary's `{document}` is then never supplied |

### 8.1 The three that did not fire

**N — the `.notes` CSS rule deleted from `SnippetList.svelte`.** The whole block loses its border,
padding and colour and reads as three unstyled paragraphs. `npm test` — **462 passed**, the suite's whole size before the review round. `npm run
check` — **0 errors, 0 warnings**. Nothing in this repository notices a dead or missing style rule,
which is 1c-2a's experiments N and P recurring on new markup, and is why hole 7 says what it says.

**P — an English string made to claim the opposite of the truth.**
`browser.detail.notEditable` rewritten to *"This app can safely edit this snippet, which contains
{kind}."* — the exact over-claim section 3 exists to prevent, on the exact screen section 7.4 reads.
The key set is unchanged, the placeholder set is unchanged, the Spanish still differs. `npm test` —
**462 passed**. **Nothing in this project checks what a string says**, and the only instrument that
has ever caught anything in this area is a person reading a screen. The review found two such
strings in this sub-phase's own diff, which is that experiment's result confirmed the hard way.

**Y — the accessor left in a comment while the markup renders the raw identifier.** The review's Low
3 says the source scans are unfalsifiable as screen claims; this is the demonstration.
`SnippetList.svelte`'s hazard list changed to `<li>{hazard}</li>` with `<!-- tHazard(hazard) -->`
above it, so `MergeKey` renders on screen in both languages. `npm test` — **26 passed** in
`findings.test.ts`, every scan green. The tests are renamed to claim only source occurrence, and this
is why; rendering a component in a test is the real fix and is not something a fix round adopts by
the way.

---

## 9. Verification

Re-run in full after the second review pass; every figure below is from that run.

| Command | Result |
|---|---|
| `cargo test --workspace` | exit 0 — 16 binaries, 0 failed |
| `cargo clippy --workspace --all-targets -- -D warnings` | exit 0, no warnings |
| `cargo fmt --check` | exit 0 |
| `npm run check` | exit 0 — 369 files, 0 errors, 0 warnings |
| `npm run build` | exit 0 |
| `npm test` | exit 0 — 25 files, **479 tests** (425 → 462 at the sub-phase's end → 476 after the review round → 479 after the second pass) |
| `cargo tree -p espansoconfig-core \| rg tauri` | **no match** — the architecture rule holds (D2x) |
| `git status --short --untracked-files=all` | no real-config path, no probe artefact |

---

## 10. What the phase got wrong on the way

### 10.1 The four the reviews had to find, and which this record did not call defects

**This subsection exists because the review was right about the record as well as about the code.**
§11 disclosed thirteen holes and disclosed them honestly — and a hole is a thing not done, while
these four were things **done wrongly**. Filing a false sentence under "coverage" would have let it
survive as a known limitation rather than a bug. The fourth was found by the *second* pass and was
introduced by the fix round itself, which is why it is here rather than in §13.

**A sentence said the app shows something it does not show.** `AdditionalDocumentNotProjected` read
*"…so document {n} **is shown** but not interpreted"*. Nothing shows it: the projection records the
later documents by span, and the raw-YAML viewer that would show them is deferred to 1c-2b-2 **by
this sub-phase's own scope**. It is 1c-2a's Medium 1 verbatim — a string claiming a rendering the
pane does not have — inside the sub-phase written to avoid exactly that, and it reached the record
unremarked because the string was *inherited* rather than written here. **A string this sub-phase put
on a screen for the first time is a string this sub-phase is responsible for**, whoever typed it. The
sweep in §6.2 is that lesson turned into a procedure, and it immediately found a second one:
`browser.detail.notEditable` claiming the *snippet* contained a hazard that may be anywhere in the
file.

**Zero-based wire indices were rendered as human document numbers.** "Document 0" for the first
document, and — worse because it looks right — "document 1" for the second. The record did not
mention it at all. A `document_index` is an offset into `SyntaxIndex::documents()` everywhere else it
is used, so the fix is a display-boundary conversion and not a wire change; §6's table and experiment
T are what it now rests on.

**A claim about profile isolation was written, twice, while the code did not hold it — and this is
the third occurrence.** §2 said a profile contributes "no snippet-list row" and §13 said it "stays out
of `scopedMatches`". Both were false when written: `scopedMatches()` flat-mapped every projected view
without asking `holdsMatches`, and a `config/*.yml` whose content carries match-file keys really does
arrive with a populated `matches`. The second review pass found it, and it is worth naming as the
pattern rather than as a bug, because it is the same pattern as the two above it: **the sentence was
written from the intent of the change rather than from the code the change produced.** The first two
were strings on a screen; this one was a doc claim, which is 1b-2a's "an identity designed to survive
something has to be shown surviving it" in its cheapest form. The rule that catches all three is the
same: *state the claim, then find the line that makes it true, and if you cannot point at one, the
claim is a plan.* The two sentences are true now, and `keeps a match-shaped profile's matches out of
the list the total counts` in `workspace.test.ts` is the line to point at.

**Distinct findings were collapsed into one sentence.** §4 argued the dedup rule's failure mode was
"one-directional — the worst it can do is show a line twice", and that argument was about *two codes
stringifying differently*. It never asked the other question: whether two records the rule calls
equal are two things the user needs to know about. Twenty `KeyNotAccountedFor` diagnostics became one
line saying "one key of this file". **An argument that a rule is safe is not a check that it is**, and
the argument here was carefully made about the wrong axis.

### 10.2 The ones the phase caught itself

**The `{@const}` was written where Svelte will not take one.** `describeFindings(browser.scopedDocument)`
started as an `{@const}` in the middle of `SnippetList.svelte`'s markup and `svelte-check` refused it:
`{@const}` must be the immediate child of a block, and this one is needed *before* the `{#if}` that
would have had to contain it. It is a `$derived` in the `<script>` now, which is also better —
memoized rather than re-evaluated by each reader. Caught by `npm run check`, in seconds, which is the
kind of thing that check is for.

**An "independently derived" expectation was written in the production module.** The first draft of
`findings.ts` exported an `expectedDiagnosticIdentities()` for the tests to compare against — which
is the same code as the implementation, so the comparison could never fail. That is D2w exactly, and
in its purest form: an audit derived from the thing it audits. It was deleted and the expectation is
now a hand-written list of codes in `findings.test.ts`, read off the input document.

**A fixture nearly shipped contradicting itself.** `makeDocument` gained a `hazards` override while
`safely_editable` stayed hardcoded `true`, so any fixture with a hazard claimed the document root was
editable. Nothing in the frontend reads that field yet, so nothing would have failed — and the next
phase to read it would have found the fixture, not the code, was wrong. It is derived now, with the
Rust reasoning written beside it (any hazard disqualifies the root, because the root is an ancestor
of everything and `disqualifying_hazard` fires on ancestors and descendants alike).

**A test asserted something the markup does.** `findings.test.ts`'s "asks the model" check first
asserted `not.toContain('.diagnostics.length')` — which the markup legitimately contains, as
`findings.diagnostics.length`. It names `scopedDocument.diagnostics` now. A guard that fails on
correct code is a guard that gets deleted.

**And the oracle written to satisfy D2w was itself vacuous.** The "what a document owes a line" suite
compared the output against a hand-written `OWED` list of codes — hand-written, derived from the
input by eye, and **short**: it named `MatchHasNoTrigger` once for an input holding two, so it agreed
with the dropping policy by construction and could never have disagreed with it. The review caught
it, and it is R24's corollary yet again: the test's *name* claimed the document's owed lines, and its
*body* could not have failed if that claim were false. It is a **conservation** count now — the sum
of every line's `occurrences` against a distinct-record count read off the input — which no grouping
policy can satisfy while losing a finding.

---

## 11. Coverage holes, stated as holes

1. **No component is rendered by any automated test.** Inherited, unchanged, and now carrying more
   weight than before: three components changed in this sub-phase and the evidence for all three is
   section 7 plus two text scans that can only see whether a component *names* an accessor.
2. **A file that failed to parse and a file with no snippets show the same `0`.** Visible in section
   7.2: `match/broken.yml` shows `0` with the tooltip "0 snippets", exactly as an empty but valid
   file would. The sidebar tells *could not read* from *have not read* now and still does not tell
   *read but not parseable* from *read and empty*. `DocumentView.parsed` is on the wire and
   `describeFindings` already carries it; nothing renders it as a row marker. This is the same
   *shape* of defect item 3 fixed, one level down, and it is 1c-2b-2's to take or to leave.
3. **A *hazard's* number of occurrences is not shown**, although a diagnostic's now is. "a merge
   key" says nothing about whether it is in one place or forty. The data is derivable (count the
   `Hazard` diagnostics per kind) and
   section 6 records why it was not done.
4. **A diagnostic about the selected match is shown at file level, not beside the match.**
   `MatchHasNoTrigger` for one snippet of a ten-snippet file appears in the middle pane with nothing
   saying which snippet. `Diagnostic.node` and `MatchView.source_node` would correlate *some* of
   them and not the ones raised at child nodes; a partial correlation presented as complete is worse
   than none. Doing it properly needs an ancestry test the frontend does not have.
5. **`blockedUnnamed` was never on a screen and cannot be provoked from a file.** Rust derives both
   editability fields from one call, so the arm exists for a wire that contradicts itself. Unit
   tested only.
6. **Two of the three unmodelled-key arms were still not on a screen.** `named` was, twice.
   `empty` (a key that is the empty string) and `unnamed` (a key that is not a scalar) remain
   unit-tested only, as at 1c-2a.
7. **`.depth-2` … `.depth-5` are still unverified as *applied*.** `.depth-0` and `.depth-1` are now
   measured (section 7.5), which is a real narrowing of 1c-2a's hole 6, and the deeper four are not
   — the reading's file nests two levels. More generally, experiment N shows nothing mechanical
   notices a dead style rule, so every other rule in this sub-phase's markup is in the same
   position.
8. **The findings block is unreachable from the "All" scope.** A file with a parse error is silent
   until the reader clicks its sidebar row, and the only hint on the way is a count of `0` (hole 2).
   Aggregating every file's diagnostics into the "All" scope was rejected as a wall of text with
   nothing saying which file each line is about; the honest fix is hole 2's row marker.
9. **~~A config profile's diagnostics are unreachable entirely.~~ Closed by the review round.**
   `open()` projects every listed document now; `holdsMatches()` governs counting only. Kept in the
   list rather than deleted so that the reason is on the record: it was disclosed as a hole and it
   was a **defect**, and the difference is that a hole is a thing not done. What remains of it is
   the **cost**: every profile is parsed at startup, and nothing in this project has measured the
   load time of a large real configuration.
10. **Nothing runs a real projection through `describeFindings` in a test.** The fixtures are
    hand-written wire shapes, as in 1c-1 hole 2 and 1c-2a hole 11. Rust pins what the projection
    contains, TypeScript pins what this model does with one, and section 7 is the only place the two
    have met.
11. **The aggregation is untested against a real document's diagnostic list.** It is tested against
    hand-built records, including a twenty-occurrence one. Whether a real configuration ever
    produces twenty `KeyNotAccountedFor` diagnostics — and therefore whether "in 20 places" is a
    sentence anyone will read — is not measured anywhere.
12. **"In N places" says nothing about *which* places**, which is the honest residue of the
    aggregation. A located line per occurrence is strictly better and needs a line number: the span
    is on the wire, and turning a `ByteSpan` into a line number is a Rust job for the same reason
    slicing an unmodelled value is (a JavaScript string index is a UTF-16 offset).
13. **The Spanish is eight more values of unreviewed prose and two rewritten ones**, and one of them
    — `browser.list.notes.label` versus `browser.list.notes.diagnostics` — differs from its
    neighbour only by a colon, which is the kind of near-duplicate that reads badly aloud and that
    only a bilingual reader will catch.
14. **Nothing shows a diagnostic's span, node or path.** Deliberate — the model does not carry them,
    so it cannot imply it shows them — but a reader who wants to find the reported line in their
    editor has a line and column only when the diagnostic is `ParseFailed`.
15. **~~The one-based display conversion is a table of one entry, maintained by hand.~~ Closed by
    the second review pass.** `DIAGNOSTIC_DISPLAY_INDICES` is a mapped type over
    `DiagnosticCodeName`, so a new variant is a compile error here. What is *not* closed: the table
    says which operands are indices, and nothing checks that claim against Rust. A variant whose
    operand becomes zero-based without being renamed would keep an empty row and nobody would know.
    That is a Rust-side fact with no wire representation, and giving it one is a bigger change than
    this hole is worth today.
16. **`ShapeDisagreesWithLocation` is the only thing telling a reader why a match-shaped profile
    lists nothing.** It happens to be raised for exactly that shape, so the screen reads correctly —
    but the emptiness and the sentence are produced by two unrelated pieces of code, and nothing
    ties them together. A future document kind excluded by `holdsMatches` without a matching
    diagnostic would show an unexplained empty list.

---

## 12. What 1c-2b-2 inherits

- **A file-level surface that already exists.** `findings.ts` and the `.notes` block in
  `SnippetList.svelte` are where anything else said *about a file* goes. The raw-YAML viewer's
  entry point belongs beside them, and hole 2's "did not parse" row marker is a two-line change to
  `sidebar.ts` plus one dictionary key.
- **`describeFindings()` already carries `parsed`** and nothing renders it. It was put there for
  hole 2 and for the viewer, which needs to offer raw text most urgently for a file that has no
  projection.
- **`MatchView.source_text` still has no reader**, and `DocumentView`'s `byte_len`, `line_ending`,
  `bom`, `stream_documents`, `shape` and `top_level_keys` have none either. All are source facts, so
  D2u permits every one of them.
- **`document_text` is still not a registered Tauri command.** `main.rs` registers six and it is not
  among them; adding it is a command, a `types.ts` mirror entry, `wire_contract.rs` and
  `dispatch_check.rs`. That is 1c-2b-2's, and it is the one item of this sub-phase's siblings that
  touches Rust.
- **An unmodelled entry's value is still not on the wire** (1c-2a hole 13, unchanged). The strings
  still say only that the entry was recorded and left untouched, and **no string in either dictionary
  may claim otherwise** until a Rust-sliced source span crosses the boundary.
- **`LoadFailure` carries a `DocumentId`**, so anything that needs to attach a refusal to a file —
  a retry button, a row-level message — has the identity already.
- **The refusal-not-permission rule.** `unrestricted` draws nothing, `detail.test.ts` asserts the
  string `'unrestricted'` is absent from the pane, and experiment P shows that nothing but a reader
  would catch a string rewritten to claim the opposite. Phase 2 is the first phase entitled to say
  anything positive about editability, and it will have earned it by then.
- **`plural.ts` has three pairs now.** A fourth counted noun goes beside them, not into a call site.
- **Every listed file is projected at startup**, profiles included, and nobody has measured what
  that costs on a large real configuration. If it turns out to matter, the lazy alternative the
  review named — project a profile when its row is selected — is a change to `open()` and
  `scopedDocument` and to nothing else.

---

## 13. The review, and what each finding did to the code

`docs/reviews/phase-1c-2b-1-typed-judgements.md` — one High, three Medium, three Low. The phase was
held open until all seven were closed, which is what every phase since `8989c16` has done, so no
commit holds the demonstrated defects.

| # | Finding | What changed |
|---|---|---|
| High 1 | `AdditionalDocumentNotProjected` said the later document "is shown" | Reworded in both languages to *"Document {document} was not interpreted, because espanso reads only the first document of a file."* — and the other five new strings and one reworded one were checked against their data the same way, which found a **second** false claim (§6.2, §3) |
| Medium 1 | Diagnostic identity was the code alone, so distinct findings collapsed | `occurrenceIdentity()` added beside `diagnosticIdentity()`; lines carry `occurrences` and `repeated`; the pane says "in N places" through a third `plural.ts` pair. The `OWED` oracle was replaced by a conservation count derived from the input (§10.2) |
| Medium 2 | Findings unreachable for config profiles | `open()` projects every listed document; `holdsMatches()` governs counting **and scope**, so a profile keeps its `–` and stays out of `scopedMatches`. **Attempted and completed, not deferred.** The first cut of it left `scopedMatches()` unguarded and the second review pass caught that — see section 13.1 |
| Medium 3 | Zero-based wire indices shown as document numbers | `ONE_BASED_DISPLAY_OPERANDS` in `codes.ts` converts at the display boundary and emits the operand under a *display* name, so a stale dictionary leaves a visible placeholder. Wire and Rust unchanged. Indices 0 and 1 both tested |
| Low 1 | The unnamed refusal invented a file-level cause | *"…and no reason was given."* The arm's doc comment now says why the explanation is not this model's to supply |
| Low 2 | The hazard union did not deduplicate its first input | Seeded from a `Set`; the duplicated-summary fixture is in `findings.test.ts`, with the run-time reason (a duplicate `{#each}` key throws in a component no test renders) |
| Low 3 | Two test names claimed more than their bodies could check | Renamed to claim only source occurrence; the suite comments name R24's corollary and say why a component-rendering library is not adopted here. Experiment Y demonstrates the scenario the names used to hide |

**What the review found sound** and is worth keeping stated: the `DocumentId` load-failure keying,
the updating of all production read sites, the exclusion of refused documents from `pending`, and
the verdict/reason split in the named editability arm.

### 13.1 The second pass, and the two things the fix round broke

A narrow second pass confirmed all seven closed — including the `notEditable` claim the fix round
found on its own, which it checked against `disqualifying_hazard` in
`crates/espansoconfig-core/src/syntax/trivia.rs` and confirms is supported. It then found **two
defects the fix round had introduced**, which is the argument for a second pass rather than a
sign-off.

| # | Finding | What changed |
|---|---|---|
| Medium | Match-shaped profiles leak into `scopedMatches` — **Medium 2's own regression** | Both branches of `scopedMatches()` ask `holdsMatches(view)`. A `config/*.yml` carrying match-file keys is projected as `DocumentShape::MatchFile` on purpose, so `view.matches` is populated on a document whose `kind` is `ConfigProfile`; the sidebar count already excluded it, so the list showed rows the total did not count. Before Medium 2's fix no such view existed. Also §10.1: two sentences of this record asserted the isolation that the code did not have |
| Low | A future differently-named index operand would silently stay zero-based | `ONE_BASED_DISPLAY_OPERANDS` — one entry, keyed on an operand *spelling* — became `DIAGNOSTIC_DISPLAY_INDICES`, a **mapped type over `DiagnosticCodeName`** with a row per variant, so a variant added to the union and forgotten is a `npm run check` failure in `codes.ts`. Most rows are `{}`, and an empty row is a statement: *this variant's numbers are counts, not indices* |

**The typed route was taken, and it did not have to touch anything the Low warned about.** The
orchestrator's fallback — write it down as a hole rather than weaken `codes.ts` — was not needed: the
table is a value with a mapped-type annotation and sits beside `ENUM_OPERAND_NAMESPACES`, nowhere
near the key builders whose template-literal return types are the guarantee this file exists for. The
shape is `COMMAND_ERROR_OPERANDS` in `src/lib/ipc/errors.ts`, which already lists every code
including the ones with no operands.

**What the second pass found sound**, restated because it is a check on this record's own claims: the
aggregation is consistent (distinct records join their sentence group, `repeated` is exactly
`occurrences > 1`), the new plural pair selects correctly at 0, 1 and 2, and a stale
`{document_index}` placeholder genuinely does survive visibly through `dictionaries.ts` — so §6's
"visible placeholder rather than a wrong number" is a property and not a hope.
