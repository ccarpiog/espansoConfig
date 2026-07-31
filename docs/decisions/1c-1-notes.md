# Phase 1c-1 — the three-pane shell and the data path

The first screen in this project that renders real configuration data. Everything before it was
either below the screen (the fidelity engine, the read model, the IPC boundary) or beside it (the
i18n layer, the menu). This sub-phase joins them: `open_workspace` → `list_documents` →
`get_document` → three panes → a search box → a selection that survives, or is honestly reported
not to have.

Its deliverable is the **shell and the data path**, not the snippet view. Plan section 3.3's 22
fields are 1c-2's, and the detail pane says so in both languages rather than half-rendering them.

**This record was corrected by the phase's own adversarial review.** `docs/reviews/phase-1c-1-shell-and-data-path.md`
found two High, five Medium and three Low findings, and a twelfth defect — a missing plural — was
found while closing them. **Section 13 is the disposition.** Six sentences below were false when they
were written and are now rewritten rather than annotated: the fingerprint's reach (sections 1 and 6,
hole 3), the fixture's re-transcription (hole 2), `selectedMatch` being live (section 12), the
unreadable file being visible (section 2), experiment E being unnecessary (section 8), and the detail
pane not having started 1c-2 (sections 1 and 12).

---

## 1. What was built, in one paragraph each

**`src/lib/browser/workspace.svelte.ts`** — the state. It calls the read-only commands, holds the
document list and every projection, and exposes the sidebar model, the scoped and searched match
lists, the selection and the notice. Its commands arrive as an **injected object** (`BrowserCommands`)
whose default is the real boundary, because the only way to test what a selection does about an
`identityStaleRevision` is to make `get_match` produce one.

**`src/lib/browser/sidebar.ts`** — grouping and counts. Three groups keyed off `DocumentSummary.kind`,
per-file match counts, and the distinction between *not read yet* (`null`) and *read and empty* (`0`).

**`src/lib/browser/search.ts`** — the predicate. It reads `MatchView.search_text` and nothing else.
The core builds that haystack out of the trigger, the label, **every** content field, the comment and
`search_terms`; it used to be the *primary* content field only, which made the `html` of a match that
also had a `replace` unfindable.

**`src/lib/browser/labels.ts`** — what a row shows: the trigger as source text (or a `TriggerKind`
code when there is none), the label as source text or `null`, and the badges exactly as the core
computed them.

**`src/lib/browser/selection.ts`** — R27 as code: a held identity, the position it was at, the
match's **complete source slice** as a fingerprint, and `repairSelection`, which turns
`identityRecovery`'s classification into one of four decisions — and hands back the projection it
read, because a decision about a selection is also a decision about the document it is in.

**`src/lib/browser/notices.ts`** — the four notice codes and the one place each becomes a dictionary
key. A component reaches that place through `tSelectionNotice`, never by calling it.

**Four components** — `AppShell` (the four states and the grid), `Sidebar` (the groups, the counts,
and the sentence that says a total is partial), `SnippetList`, `DetailPane` (a localized stub: the
file the selection is in, and a sentence saying the snippet view is next — **no field of the match**).

---

## 2. The data path: everything match-bearing is projected up front

`open()` walks the document list and calls `get_document` for every `MatchFile` and every `Package`,
in order, before the status becomes `ready`.

**Why not lazily, on click?** Because two things on the first screen are statements about the *whole*
configuration and not about whichever file has been clicked: the "All (N)" total, and the "All" list
that a search runs over. A lazy load makes both of them true-about-what-is-loaded and misleading
about the configuration, with nothing on screen saying which. The cost is bounded: `Workspace` caches
per `ContentRevision` (1a, R19), so this is one parse per file per session, and a configuration is
tens of files.

**A config profile is listed and not projected.** It holds no matches; asking for it would parse a
file nothing on this screen reads. That is why `SidebarModel.pending` counts only match-bearing
documents, and why the profile row renders "not read yet" rather than a count.

**One unreadable file does not blank the window — and does not hide, either.** A `get_document`
failure is reported through `reportIpcFailure`, kept on `BrowserState.loadFailures` and skipped; the
workspace still reaches `ready` with the files that did read, and the sidebar renders
`browser.sidebar.partialTotal` plus one localized sentence per refusal, directly under the "All"
count that the refusal made partial. Only `open_workspace` and `list_documents` can fail the whole
screen, because without them there is no list to show.

The review found this paragraph making the right argument and the code not carrying it out: `pending`
was computed and never rendered, the failure reached the console alone, and two files holding 2 and
100 snippets showed **"All 2"** with nothing on screen saying that 100 of them were missing.

---

## 3. Four states, and why `configDirNotFound` gets its own heading

`loading` · `failed` · ready-and-empty · ready. The failure arm renders `tIpcFailure(failure)`, so
every code the boundary can produce has a sentence in both languages with no new error channel. The
*heading* above it is one of two: `configDirNotFound` is not a fault — espanso may simply not be
installed — and telling a first-run user that something went wrong would be a lie in the one state
they are most likely to be in.

The empty state needs `summary.root`, so it renders the path it opened. A path is not corpus content
(CLAUDE.md section 1 permits file names and counts), and it is the one fact that makes "this
configuration holds no files" actionable.

---

## 4. Search: the haystack is the core's, the rule is the frontend's

`MatchView.search_text` exists because the core said so, in a doc comment that is a design decision
rather than a convenience:

> Precomputed here rather than assembled per keystroke in the frontend, so that what the search
> covers is one fact stated once and testable.

So `searchHaystack()` is one line — `return match.search_text` — and re-deriving the five fields here
would have made it two facts in two languages with nothing comparing them.

**One of those five was narrower than the plan says, and the review caught it.** *Content* was
`ContentSpec::primary()`, the field the editor shows first, so a match writing both `replace: alpha`
and `html: needle` — malformed for espanso, listable for this browser, and real in files people
actually have — put only `alpha` in the haystack, and `needle` could not be found although it is
plainly in the file. `build_search_text` now takes every present content scalar through
`ContentSpec::collect_scalars`, which is also what the type-inference oracle walks, so the two cannot
come to disagree about what "every content field" means.

What the frontend does own is the matching rule: `toLocaleLowerCase` (not `toLowerCase`: the
interface is bilingual and the two differ for real users), whitespace-split terms, **all** of which
must occur, and an empty query that filters nothing. Results keep source order; a relevance ranking
would replace an order the user put in the file with a number they cannot see.

**The assertion with teeth is the negative one.** Five positive assertions pass against
`JSON.stringify(match).includes(query)`, which also searches the word-boundary options, every
variable parameter, every byte span and every node identifier. `does not match a word-boundary
option, however tempting the value` is the test that fails when the haystack widens, and experiment
A confirms it fires.

---

## 5. Badges come from badge data — D2u seen from the snippet list

The core derives every badge from a key's presence or a `type` field's text, and
`badges_come_from_key_presence_and_type_text_never_from_a_scalar_value` pins that it never derives
one from a scalar's value. The frontend is exactly where that would come back: a row holding
`content.html` can produce an HTML badge in one line, and no Rust test would ever see it.

`badgesOf()` therefore returns `match.badges` unchanged, and two fixtures disagree with each other on
purpose:

- a match whose `html` field is set and whose badge list is **empty** — a value-deriving frontend
  answers `['Html']`;
- a match with an `Html` badge and **no** `html` field — a value-deriving frontend answers `[]`.

Badge data wins in both, so an implementation that looked at the fields fails one of them whichever
way it leaned. Experiment C confirms the first.

The same rule governs the trigger: `triggerLabel()` returns source text, or a `TriggerKind` **code**
which the component renders through `tTriggerKind`. A trigger written `on` renders as the two
characters `on`, and there is a test that says so.

---

## 6. R27 in the selection: a position to look at, a fingerprint to check with

A `MatchId` is scoped to the parse that minted it. When `get_match` answers `identityStaleRevision`,
the document moved on and **nothing is known about whether the match survived**. `DocumentPath` is not
a fallback identity, and neither is the position this phase keeps: a sequence step is a position, so
deleting the first match of a file leaves `matches[1]` resolving perfectly well, to what used to be
`matches[2]`.

So the selection holds four things — the identity, the document, the position, and a **fingerprint of
the match's complete source slice** — and re-resolution is: read the document again, look at the
position, then *check*. And what it read is installed, because a fresh identity over a stale
projection is a browser showing rows that are not on disk.

| What re-resolution finds | Answer | What the browser does |
|---|---|---|
| the same fingerprint | `sameMatch` | selection moves to the **new** identity; notice `kept` |
| a different fingerprint | `differentMatch` | selection **cleared**; notice says a different snippet is there now |
| nothing at that index | `gone` | selection cleared |
| the reload itself failed | — | selection cleared; notice `unresolved` |

**The fingerprint is `MatchView.source_text`: the bytes `MatchView.span` names, and nothing else.**
Source text, so it decides nothing D2u reserves — and *complete*, which the thing it replaced was not.

This is the review's first High finding, and it is worth stating plainly because the first version
looked safe. The fingerprint was `search_text`, the badge list and the two shape codes: three facts
about the file, none of them resolved, all of them checkable. What none of them carries is `word`,
`propagate_case`, `left_word`, `right_word`, `force_mode`, any variable, any form field, any
unmodelled entry, or any content field that is not the first. So

```yaml
- trigger: :same
  replace: body
  word: true
- trigger: :same
  replace: body
  word: false
```

fingerprinted *identically*. Delete an earlier match, and position 1 — which held the first — now
holds the second; re-resolution answered `sameMatch`, and the browser moved the selection to a
different snippet while telling the user it had found theirs. A comparison that can say "the same" is
a comparison that must be able to see everything that could make it different, and a projection is by
construction a thing that leaves something out.

The core therefore carries the slice. `MatchView::project` copies `source[span.start..span.end]` once
per match; `every_projected_match_carries_exactly_the_bytes_its_span_names` asserts across the whole
synthetic corpus that it *is* the slice and not a re-rendering, and
`two_matches_that_differ_only_in_an_option_have_different_source_text` is the counterexample above,
with the premise asserted first — the two matches' haystacks, badges and both kinds are checked to be
equal before their slices are checked to differ, so the test cannot pass for the wrong reason.

**Why not a hash, and why not "clear on any stale revision".** A hash is a claim with a collision
probability attached; the slice has none, and a configuration is tens of files, so the memory it
costs is the file text once more. Clearing on every stale revision was the review's stated fallback
and it discards a selection the file still holds, every time anything else in the file changes.

`repairSelection` never switches on an error code — it switches on `identityRecovery`'s
classification — so a new code cannot be handled here and forgotten there.

**The agreement is asserted, not assumed.** `RESOLUTION_OUTCOMES` in `selection.ts` and the `mayFind`
list on the boundary's `reresolve` arm are compared as sets in `selection.test.ts`. Neither side can
quietly stop admitting `differentMatch`.

**The TODO in `src/lib/ipc/errors.ts` is discharged.** `identityRecovery`'s doc comment said "*TODO
(Phase 1c): wire this to selection state*" and warned that what it must not become is
`if (stale) forget()`. It has a caller now, and the caller distinguishes all three answers. The
comment itself is left in place: it names the phase, and rewriting history in a doc comment is worse
than a stale pointer.

---

## 7. The strings, and where the lint cannot see them (R31)

**33 keys added** under `browser.`, in both dictionaries, and the two `shell.placeholder.*` keys the
old scaffold used were removed with the scaffold. The dictionaries now hold **169 keys each**: 111
`code.`, 33 `browser.`, 16 `menu.`, 9 others. The `code.` namespace is untouched, so
`dictionary_contract.rs` — which filters on `code.` — is unaffected.

The review round changed the *composition* of those 33 without changing the count, which is a
coincidence worth stating so the numbers above are not read as "nothing moved": `browser.detail.trigger`
and `browser.detail.text` went with the detail pane's field rendering (section 13, Low 3),
`browser.sidebar.snippetCount` was split into `.one` and `.other` (section 13, the plural defect), and
`browser.sidebar.partialTotal` was added (section 13, Medium 4).

`scripts/lint/hardcoded-strings.ts` sees `.svelte` **markup** only. These are the places this
sub-phase put user-facing text where it cannot see, each of which is a `t()` call and none of which
is a literal:

1. **`AppShell.svelte`'s `failureHeading()`**, in a `<script>` body: two `t()` calls behind an `if`.
2. **`Sidebar.svelte`'s `{@render group(t('browser.sidebar.files'), …)}`** — the heading arrives as a
   **prop**, which is the scanner's hole 4. The alternative was three copies of the same twenty lines
   of markup.
3. **`notices.ts`'s `selectionNoticeKey()`** — a `.ts` file, hole 3. It contains four literal
   **keys**, not four sentences, and each is type-checked against `TranslationKey`. **No component
   calls it**: `DetailPane` calls `tSelectionNotice`, the thirteenth accessor, for the reason the
   next paragraph gives.
4. **`title=` attributes** built from `tSnippetCount(…)` — an expression, which the scanner accepts
   without knowing where it came from (hole 2).

**A second scanner now covers the other half of the rule.** The review found `DetailPane` rendering
`t(selectionNoticeKey(browser.notice))` — a component turning a code into a key, which CLAUDE.md
section 2 and `PROGRESS.md` both forbid, and which `hardcoded-strings.ts` structurally cannot see: an
expression in that position is exactly what it wants to find. `scripts/lint/built-translation-keys.ts`
is the complement: it reads every component and reports any call to the bare `t(` whose first
argument does not begin with a quote. The two together are the mechanical half of the rule — *no
literal sentence in markup*, *nothing but a written key in `t()`* — and it caught a **second**
instance nobody had noticed, `LanguagePicker`'s `t(localeNameKey(candidate))`, which has been there
since 1b-1 and is now `tLocaleName`. The scanner's own holes are enumerated in its module doc; the
largest is that a key built *inside* an accessor is fine and invisible to it, which is the point.

What the scanner *did* verify is that no pane, no row, no heading and no message is a literal in
markup. What no check verifies is that the 36 Spanish values are Spanish; that is still the standing
hole 1b-1 opened and it now covers a visible screen.

**Three glyphs are deliberately not in the dictionaries**: `⌗` before a badge, `🔒` beside the
packages heading, and `–` in a count that has not arrived. Each is `aria-hidden` or paired with a
translated label (`Read-only`, `Not read yet`), and each is punctuation rather than prose. The
scanner accepts them because they contain no letters, which is the right answer for the right reason.

---

## 8. The disabling experiments

Each is one edit, run against the code as it stood, recorded, and reverted. All seven fired.

| # | The break | What fired |
|---|---|---|
| A | `searchHaystack` returns `JSON.stringify(match)` | 3 tests, `does not match a word-boundary option` among them |
| B | `searchHaystack` returns the label only | 10 tests across all five fields |
| C | `badgesOf` appends `Html` when `content.html !== null` | `shows no badge for a field the core did not badge` |
| D | `buildSidebar` reads an unknown count as `0` | `distinguishes "not read yet" from "empty"`, the pending count, and the workspace's unreadable-file case |
| F | `reresolve` skips the fingerprint comparison | the two `differentMatch` tests and the workspace's clearing case |
| G | `repairSelection` maps `clearSelection` to `unchanged` | `does not even try to re-resolve…` and `clears the selection when the snippet is simply not there` |
| H | `positionOf` always answers the first match | the two `positionOf` tests and `holds the identity and checks it across the boundary` |

(There is no experiment E, and the reason recorded here was **wrong**. It said the drafted break —
counting a profile in the total — was already covered by `does not wait for a profile, which holds no
matches`. It was not: that test handed `buildSidebar` a profile with *no count*, so it exercised
`pending` and never the total, and `buildSidebar` really did add a profile's count to the total. The
review found it, the fix is in `sidebar.ts`, the test now supplies a count of 5, and the experiment
that was skipped is row R below.)

### 8.1 The fix round's experiments

Rows A–H above were run against the code as it stood before the review. These were run against the
code as it stands now, each is one edit, each was reverted, and all fifteen fired.

| # | The break | What fired |
|---|---|---|
| I | `matchFingerprint` returns the old display projection | `answers differentMatch for a twin that differs only in an option`, `changes when an option no other field of the view carries changes` |
| J | `applyRepair`'s `kept` arm stops installing the reloaded document | `installs the re-read document, not only the identity it found there` |
| K | `applyRepair`'s `cleared` arm stops installing it | `drops a deleted snippet from the list, not only from the selection` |
| L | `select()` reads the generation instead of taking a new one | both tests of `two requests that overlap` |
| M | only `select()`'s check after `get_match` is removed | `lets the newer selection win, however late the older one answers` |
| N | only `select()`'s check after the recovery is removed | `lets the newer selection win even when the older one is already recovering` |
| O | `open()` stops resetting `selection` and `query` | `forgets the file filter and the query the first one was left in` |
| P | `open()` drops its generation check | `lets the newer open win, however late the older one answers` |
| Q | `open()` stops recording `loadFailures` | `keeps going when one file cannot be read`, `starts each open with no failures held over from the last one` |
| R | `buildSidebar` adds a count for a document `holdsMatches` refuses | `neither waits for a profile nor counts one, whatever count it is handed` |
| S | `DetailPane` renders `t(selectionNoticeKey(…))` again | the built-key scan of `DetailPane.svelte` |
| T | `snippetCountKey` always answers the plural | `is the singular for exactly one`, `is singular for one in both languages` |
| U | `build_search_text` goes back to `ContentSpec::primary()` | `search_text_covers_every_content_form_and_not_only_the_primary_one` |
| V | `MatchView::project` sets `source_text` to the empty string | `every_projected_match_carries_exactly_the_bytes_its_span_names`, `two_matches_that_differ_only_in_an_option_have_different_source_text` |
| W | `fixtures.ts` stops transcribing `html` into `search_text` | `searches a secondary content form, not only the one shown first` |

**One row had to be earned, and it is recorded rather than quietly fixed.** M did *not* fire at first:
the two generation checks in `select()` overlap, so removing the earlier one left the later one
catching the same case, and no test could tell the difference. That is a test claiming a check is
load-bearing when it is not — R24's shape again. The earlier check does buy something real, though: a
selection the user has already replaced must not issue a `reload_document` nobody will look at. The
test now asserts `reloadDocument` was never called, and M fires.

---

## 9. What the phase got wrong on the way

1. **The first `differentMatch` test could not produce a `differentMatch`.** It selected the *second*
   match and then deleted the first, which leaves position 1 holding nothing — `gone`, not
   `differentMatch`. The R27 counterexample needs the selection on the match that is **deleted**, so
   that its position still resolves. Fixed, and the test now carries the comment that says which
   match is which. This is R24's corollary in miniature: the name claimed one thing and the body did
   another, and only running it said so.
2. **A dictionary key that was identical in both languages.** `browser.sidebar.count` was `({count})`
   in English and in Spanish, which is a real untranslated value and would have needed an exception
   with a reason. Replaced by `browser.sidebar.snippetCount` — "{count} snippets" / "{count}
   fragmentos" — used as the row's `title`, with the bare numeral rendered in markup. The parentheses
   were never the message; the noun is. **And the noun was singular half the time**: the replacement
   had one form per language, so a file with one snippet read "1 snippets". That is item + of section
   13, and the key is now a `.one`/`.other` pair.
3. **`this.scopedMatches` inside the returned object literal.** It type-checked and worked, and it is
   the one expression in the state that would silently break if the object were ever spread or
   destructured. Replaced by a local function both getters call.
4. **The mock command surface widened `ok` to `boolean`.** `{ ok: true, value }` written inline in a
   `vi.fn` infers `boolean`, which does not satisfy the discriminated union `CommandResult` is.
   `svelte-check` caught it; `vitest` did not, which is a reminder that the two are not
   interchangeable evidence.

---

## 10. R32: what was seen in a running application, and how

**A process that stays up is not a screen that renders** — 1b-1 reported a window that "launched and
stayed up" and it was blank. So this is what was actually observed, and by what means.

**These readings were taken against the code as it now stands, with the review round's fixes in
it.** An earlier set was taken before the fixes and is not what is written below: the fixes edited
`Sidebar.svelte`, `DetailPane.svelte` and `AppShell.svelte`, and nothing in this repository renders a
Svelte component in an automated test (hole 1), so a runtime error in any of the three would have
produced an empty pane that all 354 passing tests sail straight past. The readings were therefore
repeated, and **two were added for the parts of the screen the fixes created** — a file whose count
is 1, whose tooltip was a real defect on screen before the fix, and the partial-total block.

### 10.1 The setup

`npm run build && cargo build -p espansoconfig --features custom-protocol`, the binary placed in a
hand-assembled `espansoConfig.app` bundle (`Contents/MacOS` + `Info.plist`), ad-hoc code-signed, and
launched through LaunchServices with

```sh
open --env "XDG_CONFIG_HOME=<scratch>/xdg" --stdout <log> <scratch>/espansoConfig.app
```

**The configuration it read was synthetic and hand-written for this run** — five neutral files under
`<scratch>/xdg/espanso/{config,match,match/packages/example}`, holding `:draft`, `:sig`, `:date`, a
regex, a form, an HTML snippet, a shell variable and one package snippet, eight in all. Two of the
five files hold exactly **one** match, which is what makes the singular tooltip readable rather than
hypothetical.

**A second copy of that tree, `<scratch>/xdg-partial`, has `match/forms.yml` at mode `000`.** That is
the provocation for the partial-total block, and it had to be a *permission* failure rather than
broken YAML: a file that does not parse crosses the boundary as a `DocumentView` with `parsed: false`
and its diagnostics, not as a refusal, so invalid YAML never reaches `loadFailures`
(`a_document_that_does_not_parse_crosses_as_a_view_not_as_an_error` in `src-tauri/src/commands.rs` is
the test that says so). An unreadable file is a `CommandError::Io`, which is one.

The owner's real configuration was never opened: `XDG_CONFIG_HOME` is the first candidate
`resolve_config_dir()` probes, **`HOME` was overridden on every run**, and for the no-configuration
run both pointed at empty directories so neither candidate could resolve. Nothing in this document,
in any test and in any log kept in the repository quotes real configuration content.

### 10.2 What the accessibility route reported, and why it was not enough

This subsection is about the **machine and the toolkit**, not about this phase's code, so it was
established once when the technique was chosen and not re-run for the readings below.

The **menu bar** reads out of the accessibility tree exactly as it did at 1b-2b:
`Apple, espansoConfig, Edit, Window`. The **window does not**. Three readings, each of which is the
answer to a question 1b-2b left open:

- `System Events` reports `count of windows` = **0**, as it did at 1b-2b — but now for a **bundled,
  ad-hoc-signed** application launched through LaunchServices, which is the explanation 1b-2b
  offered ("the accessibility API declining to expose an unbundled binary's window") and which is
  therefore **wrong, or at least not the whole reason**.
- Reading the tree directly with `AXUIElementCreateApplication` rather than through System Events
  gives the same answer in a stranger form: `AXWindows` returns **one** element, and that element's
  `AXRole` is `AXApplication` — the application itself. Its children are the application and the
  menu bar. There is no `AXWindow` anywhere in the tree.
- Setting `AXEnhancedUserInterface` and `AXManualAccessibility` on the application element — the two
  attributes that make some AppKit and web-content hosts build their tree for an assistive client —
  both fail (`-25208`, `-25205`), and the tree is unchanged.

**The window is nonetheless real.** `CGWindowListCopyWindowInfo` reports
`owner=espansoConfig name=espansoConfig id=3069 layer=0 bounds=1180×760 at (985,265)`.

**The screenshot route is closed on this machine.** `screencapture -x` of the full screen produces an
all-black PNG, and `screencapture -x -R0,0,1200,120` fails outright with *"could not create image
from rect"* — the screen-recording permission is not granted to the shell this session runs in, and
granting it needs a human at the System Settings pane.

### 10.3 What was done instead, stated as exactly what it is

A **temporary probe**, built into a throwaway binary and reverted before anything was committed: a
`render_probe` command in `src-tauri/src/main.rs` that prints its argument to stdout, and a
`setTimeout` in `src/main.ts` that, 2.5 seconds after mount, sends the **rendered DOM** — the three
panes' `getBoundingClientRect()`, the row counts, `document.body.innerText`, and two things the fix
round made worth asking for by name: the **`title` attribute of every count in the sidebar**, paired
with the row it hangs on, and the `innerText` of the partial-total block or the word `ABSENT`.

The probe then **clicks the first snippet row** and reports again 1.5 seconds later, which is how the
detail pane is read. A click through `HTMLElement.click()` is the same path a user's click takes into
`onclick`; what it does not exercise is the pointer hit-testing that decides *which* element receives
one, and that is a pixel question, which is the next paragraph.

Both files were reverted with `git checkout --`, `dist/` was rebuilt from the reverted source, and
`npm run check`, `npm test`, `npm run build`, `cargo test --workspace`, `cargo clippy --workspace
--all-targets -- -D warnings` and `cargo fmt --check` were all re-run afterwards and all pass.
`git status --short` shows neither file modified and no probe artefact anywhere in the tree.

**What this is evidence of:** what WebKit actually laid out and rendered in the real application's
webview, reading the same tree a screen reader would read if the tree were exposed. **What it is
not:** pixels. It cannot see a pane painted white-on-white, a `z-index` accident, or a font that
failed to load. That is a real gap and it is hole 6 below.

### 10.4 The five readings, verbatim

Every long scratch path below is elided to `<scratch>`; nothing else is edited.

**1 — English, the full synthetic configuration:**

```
viewport 1180x728
nav.sidebar:    x=0   y=44 w=268 h=645
section.list:   x=268 y=44 w=375 h=645
section.detail: x=644 y=44 w=536 h=645
sidebar rows: 6      list rows: 8
partial block: ABSENT
```

and the text: `espansoConfig / Language / System language detected as English. / All / 8 / FILES /
match/_drafts.yml / Not loaded automatically / 1 / match/base.yml / 3 / match/forms.yml / 3 /
PROFILES / config/default.yml / – / PACKAGES / 🔒 / Read-only /
match/packages/example/package.yml / 1 / Search snippets / 8 of 8 / :draft Draft snippet … :sig
Signature … :date Today ⌗Variables … :gr(a|e)y Grey or gray ⌗Regex … :form Greeting form ⌗Form …
:bold Bold text ⌗HTML … :sh Shell output ⌗Variables ⌗Shell … :pkg Package snippet / Select a snippet
to see it here. / Edit your espanso configuration without reformatting it. / Interface language:
English`

Three panes, side by side, at three disjoint x-ranges that tile the viewport's width, each 645 px
tall. Six sidebar rows (All, three files, one profile, one package), eight list rows, the
not-auto-loaded marker on the `_`-prefixed file, the lock and "Read-only" on the packages group, the
profile showing "not read yet" rather than a count, and five badges that came from badge data.

**2 — the same configuration in Spanish** (`--args -AppleLanguages '(es-ES)'`): `espansoConfig /
Idioma / Idioma del sistema detectado: Español. / Todo / 8 / ARCHIVOS / No se carga automáticamente /
PERFILES / PAQUETES / 🔒 / Solo lectura / Buscar fragmentos / 8 de 8 / ⌗Expresión regular /
⌗Formulario / ⌗HTML / ⌗Shell / Selecciona un fragmento para verlo aquí. / Edita tu configuración de
espanso sin reformatearla. / Idioma de la interfaz: Español`. Identical geometry to the byte. The
snippet labels — `Draft snippet`, `Signature`, `Today`, `Grey or gray` — stay English because they
are the **file's** text, which is the correct behaviour and worth seeing rather than assuming.

**3 — a file whose count is 1.** The `title` on every sidebar count, which is the string the row's
tooltip shows and the defect the fix round found:

```
English                                             Spanish
All                                → "8 snippets"   → "8 fragmentos"
match/_drafts.yml                  → "1 snippet"    → "1 fragmento"
match/base.yml                     → "3 snippets"   → "3 fragmentos"
match/forms.yml                    → "3 snippets"   → "3 fragmentos"
config/default.yml                 → "Not read yet" → "Aún sin leer"
match/packages/example/package.yml → "1 snippet"    → "1 fragmento"
```

**"1 snippet" and "1 fragmento", singular, on two rows in each language.** Before the fix these read
"1 snippets" and "1 fragmentos", and both rows are in the reading above, so it was on screen rather
than hypothetical. The profile keeps its own string because it has no count at all, which is a
different statement from a count of zero.

**4 — the partial-total state** (`<scratch>/xdg-partial`, `match/forms.yml` at mode `000`). The
sidebar's block, `innerText` verbatim:

> Some files could not be read, so this total counts only the files that were.
>
> The file `<scratch>/xdg-partial/espanso/match/forms.yml` could not be read.

and in Spanish:

> No se han podido leer algunos archivos, así que este total solo cuenta los que sí se han leído.
>
> No se ha podido leer el archivo `<scratch>/xdg-partial/espanso/match/forms.yml`.

`sidebar rows: 6   list rows: 5`, the "All" count is `5` with the title `5 snippets` / `5 fragmentos`,
and the summary line reads `5 of 5` / `5 de 5`. The three unaffected files still show `1`, `3` and
`1`. The window reached `ready` rather than blanking, which is the whole point of the state: one
unreadable file must not cost the user the rest of their configuration, and the total must say that
it is short.

**One thing the reading shows that is worth writing down as found, not fixed:** the refused file's
own row shows `–` with the title `Not read yet`, which is the *same* presentation as
`config/default.yml`, a file that was never asked for. "I could not read this" and "I have not looked
at this" are different facts and the row does not distinguish them. The partial-total block names the
file, so nothing is silent, and the row is not wrong — the count genuinely is unknown. It is a
conflation worth a row-level marker in 1c-2, not a defect this phase introduced.

**5 — no configuration at all** (`XDG_CONFIG_HOME` and `HOME` both pointed at empty directories): the
three panes are `ABSENT`, and the screen reads *"espansoConfig / Language / System language detected
as English. / No espanso configuration was found / No espanso configuration folder was found in any
of the places this app looks. / Try again"* — the heading of section 3 and the `configDirNotFound`
sentence from the dictionary.

**The detail pane rendered, in both languages.** After the probe clicked the first snippet row,
`section.detail` holds `File / match/_drafts.yml / The snippet view is the next step. For now this
pane shows only the file the selected snippet is in.` and, in Spanish, `Archivo / match/_drafts.yml /
La vista del fragmento es el paso siguiente. Por ahora este panel solo muestra en qué archivo está el
fragmento seleccionado.` That is the whole of the reduced stub the fix round left behind: the file
and the placeholder, with no trigger and no label, and the notice area empty because no notice was
provoked. All five readings were taken; none had to be reported as untakeable.

### 10.5 The oldest debt, discharged

`PROGRESS.md` recorded that "nothing in the running application calls `invoke` for a *document*, so
`vite build` still tree-shakes most of the IPC layer out of `dist`". All five command names —
`open_workspace`, `list_documents`, `get_document`, `get_match`, `reload_document` — are now present
in `dist/assets/index-*.js`, and the readings above are what they returned.

---

## 11. Coverage holes, stated as holes

1. **No component is rendered by any automated test.** Every test here drives a `.ts` module. There
   is no DOM implementation in the project (`environment: 'node'`, deliberately), so nothing
   mechanical checks that `Sidebar.svelte` renders the model `sidebar.ts` builds, or that the search
   box is wired to `search()`. The evidence for the components is section 10 and a review. Adopting
   `jsdom` plus a component-testing library is a decision with its own costs, and it belongs to
   whoever needs it rather than to whoever is nearest.

   **This is the hole the review round leaned on hardest, so its shape is worth being exact about.**
   Two of the fixes have a rendering half no test can reach: that the sidebar *draws* the
   partial-total block it is now given (Medium 4), and that `tSnippetCount` is what the row titles
   *call* (the plural defect). What the tests do cover is everything below the markup —
   `loadFailures` on the state, `pending` in the model, and the key a count picks in both languages —
   plus two scanners that read the components as text: `hardcoded-strings.ts` and, new in this round,
   `built-translation-keys.ts`. A component that stopped rendering a block it was given would pass
   everything in this repository. Section 10's reading is the only evidence of the opposite kind, and
   it was retaken after the fixes with one reading aimed at each of those two blocks — but it is a
   reading a human ordered, not a check that runs, so the hole is unchanged for the *next* edit.
2. **The join between the core's haystack and the frontend's predicate is untested, and the fixture
   is a *partial* transcription of it.** `fixtures.ts` builds `search_text` by re-transcribing the
   core's join over the fields `MatchOverrides` exposes — `trigger`, `triggers`, `regex`, `label`,
   `replace`, `html`, `comment`, `search_terms` — and it models neither `markdown`, `image_path` nor
   `form`. The review was right that the previous wording ("re-transcribing the core's join") claimed
   more than that: at the time the fixture pushed *both* `replace` and `html` while the core pushed
   only the first, so the fixture was not merely partial, it disagreed. The core is the side that was
   wrong and it was fixed (section 4); the transcription now agrees over the fields it models, and
   the fixture's own module doc says which those are. Rust still pins what goes in the haystack,
   TypeScript still pins what the predicate does with one, and **nothing runs a real projection
   through the real predicate**. Section 10's reading is the only end-to-end look and it did not
   exercise the search box.
3. **The fingerprint cannot tell two byte-identical matches apart, and cannot see the trivia around
   one.** This hole was written to say that identical *snippets* were its only blind spot, and that
   was **false**: the fingerprint was a display projection, and it was blind to `word`,
   `propagate_case`, every variable, every form field, every unmodelled entry and every content field
   that was not the first. Section 6 records what that cost and what replaced it. What is genuinely
   left, over the complete source slice:
   - **two matches whose bytes are identical** re-resolve as `sameMatch` when they swap places.
     Nothing in either distinguishes them, and the user cannot see a difference either. There is
     nothing left to widen the comparison with, which is what makes this a limit rather than a defect;
   - **the slice is the match's own mapping**, so a comment on the line above it, or a blank line, is
     outside it. Two byte-identical matches under different comments are the case above with one more
     reason to be careful. 1c-1 shows no leading comment, so nothing on screen disagrees with the
     comparison; a 1c-2 that renders one should read this line before trusting `sameMatch` to mean
     "the thing you were looking at, comment and all".
4. **`reloadDocument` is only reached through a failure.** Nothing in the interface re-reads a file
   on purpose yet; there is no watcher and no refresh control, so the whole recovery path is
   reachable in the running application only if something outside it edits a file between a click and
   a command. It is driven by tests, not by use.
5. **Two places show a non-blocking failure, and the menu still has none.** The notice is
   selection-scoped; the sidebar's partial-total block is load-scoped and shows every `get_document`
   that refused (section 2). What is still console-only is the **menu**: `menuUnavailable`,
   `menuBuildFailed` and `invalidMenuLabels` remain three codes with a string and no screen. Neither
   surface is reachable from the other, so a third kind of non-blocking failure would still need a
   third decision about where it goes.
6. **No pixels were inspected.** Section 10.3. The layout is known from `getBoundingClientRect`, the
   text from `innerText`; the colours, contrast and paint are unverified, and the machine's
   screen-recording permission is what stands between this phase and a screenshot.
7. **The Spanish is still unreviewed prose**, now on a visible screen. 33 more values were written by
   the phase that wrote the checks. `dictionaries.test.ts` establishes non-identity and nothing
   establishes that a value is Spanish.
8. **The empty-workspace state was not seen in a running window.** Section 10.4 exercised
   *no configuration found*; a configuration directory that exists and holds no YAML file is a
   different arm and was only tested in `workspace.test.ts`.
9. **Nothing measures the up-front load on a large configuration.** Section 2's argument is about
   correctness, and the cost is bounded by one parse per file — but "tens of files" is an assumption
   about the owner's configuration, not a measurement of anyone else's.

---

## 12. What 1c-2 inherits

- **A working data path.** `browser.status`, `browser.documents`, `browser.sidebar`,
  `browser.scopedMatches`, `browser.visibleMatches`, `browser.selected`, `browser.selectedMatch` and
  `browser.loadFailures` are all live. 1c-2 renders `browser.selectedMatch`; it does not need to
  fetch anything. **That last sentence was false when it was written**: a recovery installed a fresh
  identity over the *cached* projection, so `selectedMatch` resolved a node the reloaded document no
  longer had, the list kept rows that were no longer on disk and the counts stayed stale. It is true
  now — `applyRepair` replaces the document in `views` before it touches the selection, and
  `installs the re-read document, not only the identity it found there` asserts all three.
- **A selection that is already R27-correct.** Do not add a second path that re-resolves by position
  without checking, and do not collapse `differentMatch` into `sameMatch`. `RESOLUTION_OUTCOMES` and
  `mayFind` are compared as sets; breaking either fails a test. **Do not narrow the fingerprint back
  to a projection**, however tidy the projection looks: section 6 is the whole argument, and hole 3
  is what is left after it.
- **`MatchView.source_text`**, the match's own bytes, on every match that crosses the boundary. 1c-2
  may show it — it is source text, so D2u permits it — and should remember that it stops at the
  match's mapping: the comment above a snippet is not in it.
- **`DetailPane.svelte` is a stub by design, and now it really is one.** It renders the notice, the
  file the selection is in, and `browser.detail.placeholder`. It rendered the **trigger and the
  label** until the review, through `triggerLabel` and `labelText` — the *snippet list's* helpers,
  which deliberately collapse `trigger`, `triggers` and `regex` to one display value. A match holding
  both a `trigger` and a `regex` therefore appeared in the detail pane showing one of them, which is
  the opposite of what a detail pane is for, and 1c-2 would have had to delete the block before
  writing the real one. Two rows of a 22-field view are not a preview of it, so there are none.
  `browser.detail.trigger` and `browser.detail.text` went with them. Plan section 3.3's 22 fields,
  the hazards (`tHazard`, ten strings and no caller), the diagnostics (`tDiagnostic`, 22 strings and
  no caller) and the raw YAML viewer are all still owed. `document_text` has no frontend caller at
  all.
- **A rendered scalar is source text.** `ScalarView.text`, always. `ambiguous_yaml_1_1` is carried on
  every scalar and nothing shows it yet — flagging it is permitted (it is a claim about risk), and
  the detail pane is where it would go.
- **The notice area exists and is selection-scoped.** If 1c-2 wants a place for a non-blocking
  failure, hole 5 is the shape of the work.
- **33 new keys under `browser.`**, and the same rule as before: a component calls an accessor or a
  literal `TranslationKey`, never a key it built by concatenation — now checked by
  `scripts/lint/built-translation-keys.ts` on every component rather than by review alone.
- **A counted noun needs two keys.** `src/lib/i18n/plural.ts` picks between them on `count === 1`,
  which is the whole of the English and Spanish rule and none of anybody else's. Adding a counted
  noun means adding a `.one`/`.other` pair and one function beside `snippetCountKey`; adding a
  language with a dual or a paucal means replacing that module, which is why the selection lives in
  one place and not in fourteen call sites.

---

## 13. The review disposition

`docs/reviews/phase-1c-1-shell-and-data-path.md`, ten findings — two High, five Medium, three Low —
plus one defect found while closing them. **All eleven are closed**; none is rejected and none is
deferred without an owner. Every High and every Medium has a test that fails without its fix, and the
disabling experiment that proves it is the row of section 8.1 named in its line.

| Finding | Severity | Disposition |
|---|---|---|
| High 1 | High | **Fixed, by the route the review preferred.** The fingerprint is now `MatchView.source_text` — the match's complete source slice, a new read-only field the core fills from `source[span]` at projection time. `espansoconfig-core` gains no dependency and stays free of tauri. §6 is the argument, hole 3 is what is left, and three tests fail without it: `two_matches_that_differ_only_in_an_option_have_different_source_text` (Rust, with its premise asserted), `answers differentMatch for a twin that differs only in an option` and `changes when an option no other field of the view carries changes` (frontend). Experiments I and V. The `word: true` / `word: false` pair the review supplied is the fixture in all three. |
| High 2 | High | **Fixed.** `repairSelection` returns the projection it read (`reloaded`, `null` only when no read happened), and `applyRepair` installs it in `views` **before** applying the selection outcome, so no getter can be read between a fresh identity and a stale document. The `differentMatch` and `gone` arms install it too, which is what stops a deleted snippet from staying in the list. §12's claim that `selectedMatch` is live is now true and asserted rather than corrected away. Experiments J and K. |
| Medium 1 | Medium | **Fixed with a generation token**, one for selections and one for opens, each compared after every `await`. `open()` bumps the selection generation as well, because a selection into a workspace that is being replaced can never be applied to the one replacing it. Experiments L, M and N — and M is the one that had to be earned; see the note under section 8.1. |
| Medium 2 | Medium | **Fixed.** `open()` resets `selection`, `query`, `documents`, `summary`, `views` and `loadFailures` before its first command, and the open-generation token stops two opens interleaving. Two tests: `forgets the file filter and the query the first one was left in` and `shows nothing of the first workspace while the second is being read`. Experiments O and P. |
| Medium 3 | Medium | **Fixed on both sides.** `build_search_text` takes every present content scalar through the new `ContentSpec::collect_scalars` rather than `primary()`, with a Rust test holding `replace: alpha` and `html: needle`; `ContentSpec::primary`'s own doc no longer claims search uses it. `fixtures.ts` agrees over the fields it models and its module doc now says which those are, which is also the correction to hole 2. Experiments U and W. |
| Medium 4 | Medium | **Fixed.** `BrowserState.loadFailures` holds every `get_document` that refused; the sidebar renders `browser.sidebar.partialTotal` and one `tIpcFailure` sentence per refusal, under the count the refusal made partial. Both dictionaries. The state half is tested (`keeps going when one file cannot be read`, `starts each open with no failures held over from the last one`, experiment Q); the rendering half is hole 1, restated there in exactly those terms. |
| Medium 5 | Medium | **Fixed, and the rule mechanised.** `tSelectionNotice` is the thirteenth accessor, in the i18n layer beside the other twelve; `DetailPane` calls it. `scripts/lint/built-translation-keys.ts` now reads every component and refuses a `t(` whose first argument is not a written key — which caught a **second, older** instance, `LanguagePicker`'s `t(localeNameKey(candidate))`, fixed with a `tLocaleName` accessor. The review's own failure scenario (two literals swapped inside `selectionNoticeKey`) is covered separately, by `map to the key that names them, so two cannot be swapped`. Experiment S. |
| Low 1 | Low | **Fixed.** `buildSidebar` adds to `total` only when `holdsMatches(document)`. Experiment R, which is the experiment E section 8 wrongly said was unnecessary. |
| Low 2 | Low | **Fixed, all eight.** Seven bodies were strengthened and one name was narrowed. `does not wait for a profile, which holds no matches` → a profile with a count of **5**, plus a second test for the unread case; `does not reorder or deduplicate` → a badge list with a real duplicate; "a non-blank sentence" → several words and a full stop; "different things in the two languages" → English compared with Spanish, for all four notices, plus the `differentMatch`/`gone` pair it already had; "visible source text" → three one-field changes from one base; "records the fingerprint" → the fingerprint asserted, and asserted *not* to be the neighbour's; the stale-recovery fixture → a genuinely different revision, with the identity, `selectedMatch`, the list and the count all asserted; "dismissed and cleared independently" → a case where the selection survives, then both directions. |
| Low 3 | Low | **Fixed by reducing the stub**, which is the first of the two options the review offered. The detail pane renders the notice, the file and the placeholder; the trigger and the label are gone, and so are their two keys. §12 says why: the helpers it was using are the list's, they collapse three trigger forms into one, and 1c-2 would have had to delete the block before writing the real one. |
| + | — | **The plural, found outside the review and fixed.** `browser.sidebar.snippetCount` had no singular, so a file holding one snippet showed "1 snippets" and "1 fragmentos" in its tooltip — and section 10.4's own reading has two rows with a count of 1 in it, so this was on screen rather than hypothetical. It is now a `.one`/`.other` pair in both dictionaries, chosen by `snippetCountKey` in the new `src/lib/i18n/plural.ts` on `count === 1`, which is the whole of both languages' rule; no i18n dependency was added. The component calls `tSnippetCount`. `plural.test.ts` pins the selection and the rendering in both languages, `dictionaries.test.ts`'s key-set and placeholder checks cover the two new keys without being told about them, and experiment T is the break. |

**What the fix round did not change, deliberately:** the five commands and the read-only boundary,
R27's three answers, the four notice codes, D2u (`source_text` is bytes out of the file, and no badge
is derived from a value anywhere), and the decision to project every match-bearing file up front. No
dependency was added in either language. `cargo tree -p espansoconfig-core | rg tauri` still finds
nothing, and the corpus is untouched — every fixture in this round is hand-written neutral YAML in a
test file.

**What it cost in surface:** one field on `MatchView` (and its twin in `types.ts`), one method on
`ContentSpec`, one field and two counters on the browser state, one module in the i18n layer, one
scanner in `scripts/lint/`, three dictionary keys added and two removed. Fifteen disabling
experiments, all fired, all reverted.
