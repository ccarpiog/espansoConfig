# Phase 2c-3a step 2 — decision record

**New and delete on a screen.** Step 1 built both as values and touched no `.svelte` file
(`docs/decisions/2c-3a-1-notes.md`); this draws them, closes the four plumbing items
`PROGRESS.md` listed under *What step 2 owes*, and supplies two of the three kinds of evidence
`docs/decisions/2c-split-notes.md` §7 requires. **The window reading is not in this record and is
still owed** — see §4 hole 1.

The authority for what is drawn is `docs/reviews/phase-2c-3a-design.md`, the design consult for the
whole of 2c-3a. Q1, Q2, Q4, Q5 and Q6 are statements about *this* screen. Where this record and that
document disagree, the consult is right and this is a bug.

---

## 1. What this step built

| File | What changed |
|---|---|
| `src/lib/components/MatchCreator.svelte` | **new** — the new-snippet form: destinations, position, two boxes, undo/redo, the save and all three outcome arms |
| `src/lib/components/MatchDeleter.svelte` | **new** — the two-phase confirmation, the inline refusal, the acknowledgement round trip and the outcome |
| `src/lib/components/MatchCreator.test.ts` | **new**, jsdom — twelve mounted cases |
| `src/lib/components/MatchDeleter.test.ts` | **new**, jsdom — seven mounted cases plus the consult's Q7 case over a **real** `BrowserState` |
| `src/lib/components/DetailPane.svelte` | two new modes of the third pane, two openers, and `saveMatch`'s new argument at its one caller |
| `src/lib/components/MatchEditor.svelte` | hands over `matchEditor.baseRevisionOf(session)` rather than letting the wrapper choose |
| `src/lib/browser/workspace.svelte.ts` | a `views` accessor; `saveMatch` takes a `baseRevision` and forwards it unchanged |
| `src/lib/browser/matchCreation.ts` | `placementOptionsOf` and `baseRevisionOf` |
| `src/lib/browser/matchDeletion.ts` | `identityInProjection`, and a **plain copy** of the identity a session holds (§2.8) |
| `src/lib/i18n/{en,es}.json` | fifty-one new sentences per language |
| `src/lib/browser/{matchCreation,matchDeletion,workspace}.test.ts` | model cases for all of the above |
| `src/lib/components/MatchEditor.test.ts` | records the base revision the editor sends |
| `src/lib/components/DetailPane.test.ts` | two cases for **reachability** — that a person can open either screen from the pane at all, which no test of the two components can establish |

**No Rust was written**, as `PROGRESS.md`'s "Next action" expected: `cargo test --workspace` is
unchanged at 1008.

---

## 2. The decisions

### 2.1 D1 — both screens are modes of the third pane, and both capture what they are about

`DetailPane.svelte` already had two: the raw editor and the small editor, each outranking the pane's
read-only subjects while it is open, because a draft or a save in flight may not be dismissed by a
click somewhere else in the window. The deletion panel and the new-snippet form are the third and
fourth, in one `{#if}` chain, and a `busy` derived withdraws both openers while any of the four is
showing.

**A deletion panel is a mode and not an inline control**, and the reason is a defect avoided rather
than a preference. Drawn inline under the selected snippet, the panel would either follow the
selection — a delete control under snippet B that would delete snippet A, which is 2c-2-2's High
finding exactly — or be keyed to it, in which case a committed deletion moves the selection, the
component is destroyed, and the outcome the person needs to read is gone with it. As a mode it
captures the snippet **and its parse** in one assignment and keeps them.

**The new-snippet form captures nothing**, and that is the opposite decision for the opposite reason:
it holds no target, its destination list is derived from files the window may re-read, and a commit
spends it. So its three readers — the summaries, the projections and the held selection — are
**functions**, and the re-seed after a commit calls them again.

### 2.2 D2 — where `confirmDelete`'s `projected` argument comes from (the item PROGRESS.md named)

**It is computed inside `MatchDeleter.svelte`, at the moment of the click, by
`identityInProjection(projections(), session.match)` — a new function in `matchDeletion.ts` — over a
`projections` prop that is a function returning `BrowserState.views`.**

Three parts, each chosen against a specific alternative:

- **Not `session.match`.** That is the failure the first review round's fifth finding closed and the
  one this argument exists to notice: the pending consent and the session's identity are minted
  together at `startMatchDeletion`, so they agree with each other however stale they both are. A
  component that handed the session's own identity back would type-check and would delete a snippet
  nobody was asked about.
- **Not `BrowserState.selectedMatch?.id`**, which `2c-3a-1-notes.md` §6 offered as one of two
  acceptable sources. It is safe — it can only be *more* refusing, since a moved selection produces a
  mismatch — but it answers a different question. It says *what is selected now*, and the middle pane
  is still clickable while this panel is open, so a person who clicked another snippet and then
  confirmed would be refused for a reason that has nothing to do with the file. The lookup asks about
  **this snippet**: the arena node, in whatever projection the window now holds for that file.
- **A function prop and not an array.** A captured array is a snapshot taken at the same instant as
  the consent, which is precisely the pair that was found agreeing while both were stale. The
  function is called in the click handler and nowhere else.

**What no type forces, in the same sentence as what one does.** `identityInProjection` answers the
current projection's identity or `null`, and `confirmDelete` compares all three of its fields against
three values minted inside the session — so a re-read moves the revision and the confirmation is
refused. What nothing in TypeScript can do is say where the argument came from: a caller may pass
`() => []`, a stale array, or a function that returns `session.match`, and no signature, no lint
scanner and no model test in this repository would notice. What closes it *for the one caller that
exists* is `MatchDeleter.svelte` computing the argument itself from a reader `DetailPane.svelte`
supplies as `() => browser.views`, and the mounted case
`refuses a confirmation once the window has read the file again` is what fails if that stops being
true. It is a fact about the code as written, not a guarantee.

**And `identityInProjection` is not a way to follow a snippet across a reparse**, which its own header
says: it resolves an arena node in the current projection and answers *that projection's* identity,
revision included. Because a revision is a content hash, an answer whose revision matches the
session's is an answer from the same bytes.

### 2.3 D3 — the panel opens with the question, cancelling leaves, and a stale confirmation is a dead end

The pane's control is what a person clicked, so `MatchDeleter` calls `requestDelete` as it opens:
asking would otherwise cost a second click on an identical control. `requestDelete` refuses when the
snippet is not deletable, so a refused snippet opens with its reason and **no** question — the
consult's Q6 read literally.

*Keep it* cancels **and closes**, because this panel replaces the snippet the person was reading and a
declined question left on screen is a panel about a decision already made.

**A refused confirmation is deliberately a dead end with an exit and an explanation.** When the
window has re-read the file, this session's own identity is from the parse that was replaced, so
asking again would collect an answer refused for the same reason; the sentence says to leave and pick
the snippet from the list, and both exits are drawn. The component holds one piece of state for this —
`confirmationRefused`, set when `confirmDelete` answers `null` — and that is screen state rather than
a rule: the alternative is a control that silently does nothing.

**A refusal with findings is acknowledged and then confirmed again.** `confirmDelete` consumes the
pending request, so consent is for one attempt; *Save anyway* records the acknowledgement and
**re-raises the question** rather than sending, so the second attempt is a second answer to a question
the person can see with the findings still beside it.

### 2.4 D4 — every file the window lists is a destination, and the refused ones are disabled

The consult's Q5, drawn: one control per **listed** file in window order — a profile, a package and a
file whose read refused included — each ineligible one disabled with its typed reason rendered
through `tDestinationRefusal`. Disabling rather than omitting is the same rule the *Edit* controls
follow: withdraw the affordance, say why, never open into a dead end.

`code.commandError.documentHasNoMatchList` is drawable for the first time in this application, and
the mounted case that drives it is what makes that a checked claim rather than a hope.

### 2.5 D5 — the position is one control, and the model builds its options

`placementOptionsOf(session, views)` answers Front, one option per anchor the given projections can
still name, then End — the consult's Q4 order — each with a key built from the anchor's three fields
and a `chosen` flag the model computes with its own `samePlacement`. The component draws a `<select>`
over that list and hands the option's *placement* back to `choosePlacement`; it never builds a
placement, and it never turns a row's index into an anchor.

**An anchor this window can no longer name is not offered.** The lookup requires the anchor's own
document *and its own revision*, so a file re-read since the form opened resolves none of its anchors
and the `after` options disappear rather than naming a snippet of a revision nobody chose. A
placement already installed when that happens is `creationRefusal`'s `anchorUnavailable`, which is the
same fact from the other side.

An anchor is **named** through `triggerLabel` in `./labels.ts` — the snippet list's own accessor — for
the reason `CreationDestination.anchors` carries identities only: a model holding display text would
be holding a second copy of what the list already draws.

### 2.6 D6 — the creation boxes accept the line-ending normalisation, deliberately, and each control says what *it* does

Measured in this application's WKWebView (`docs/decisions/2c-2-2-window-reading.md` §6): a
`<textarea>` collapses `\r` and `\r\n` to `\n`, and an `<input type="text">` **deletes** the
character. The small editor **refuses** a projected value holding a carriage return, because
rewriting it would change bytes the person never touched.

**That refusal does not generalise to creation, and this is the deliberate decision the constraint
demands.** Both values here are new: there is no text of the user's, and no bytes of the file's, that
a normalisation could reformat. So the boxes accept it and the form discloses it.

**Two controls, two measurements, two sentences — and the first version of this screen had one.**
The shared sentence said a pasted carriage return became an ordinary line break. That is what the
`<textarea>` does and the opposite of what the `<input>` does: pasting `:a\rb` into the trigger
produces `:ab`, so a person could create a snippet whose trigger is not the one the screen had just
described to them. That was the review's first finding, and the fix is two keys.
`browser.matchCreation.lineEndings.trigger` says the character is **removed**;
`browser.matchCreation.lineEndings.replace` says a line break in the body is written as a line feed
and that a pasted carriage return becomes one. Each sits inside its own control's `.field` block, and
**the choice is made by position rather than by a rule**: there is no condition in the markup about
which sentence applies, because a sentence is drawn beside the control it is about — which keeps the
component the rule-free walk §1 says it is.

**The other fix the review offered was rejected on the precedent that produced it.** Intercepting or
refusing the character is what the *raw editor* does, and it does it because reconstructing a line
ending there would reformat lines the user never touched
(`file-comments-and-mixed-endings.yml` is the fixture that pins why). Creation writes a brand-new
match, so no pre-existing byte is at stake and the proportionate answer is an accurate disclosure
rather than a refusal of a character no control in this window can produce anyway.

**What this is progress on, and what it is not.** `2c-2-2-window-reading.md` §6 records as an open
hole that a person who pastes CRLF text gets LF written and **nothing on screen says so while they
type**. Two accurate per-control sentences are progress on that hole and **not its closure**: they
are standing text, identical before the paste and after it, so nothing in this window reacts at the
moment a character is altered. Whether a person reads a sentence under a box at all is a claim only a
window reading can make, and this step takes none (§4 hole 1). The earlier version of this record
said the hole was closed for this screen; that was wrong twice over, and it is the class of defect
this project names as its worst.

The model's own two carriage-return gates stay and are still not redundant: they exist for a caller
that is not a control, since `NewMatch` carries no brand.

**What the mounted tests measured, exactly.** jsdom normalises *both* controls' API values the same
way the shipped webview was measured to: `"a\rb"` in the body reads back `"a\nb"`, and `":a\rb"` in
the trigger reads back `":ab"` — collapsed in the one, deleted in the other. So the carriage-return
case asserts both readbacks, and a second case asserts that each disclosure is inside its own box's
field block and inside neither the other's. That agreement is what makes the two sentences checkable
in a suite at all; it is **not** evidence that jsdom is WebKit, and what the shipped webview does
still rests on the reading recorded in `2c-2-2-window-reading.md` §6 and on nothing in this
repository's test suite.

### 2.7 D7 — the four plumbing items, and what each of them closes

1. **`BrowserState.saveMatch` takes a `baseRevision` and forwards it unchanged.** It read
   `view.revision` at the moment of the call, so an editor opened at R0 over a window that had since
   reprojected to R1 was submitted *as though drafted at R1* and the core found no conflict to
   report. `MatchEditor.svelte` now passes `matchEditor.baseRevisionOf(started.session)` — the
   function step 1 recorded as existing and unused for exactly this reason — and the signature and
   its one caller moved together. That completes the set: **all five writing methods on this state
   now take a base revision and forward it unchanged**, and none of them reads its own projection's
   at the moment of the call.
2. **`BrowserState.views`.** One projection per file that *read*, which is not one per listed file —
   the accessor's own doc comment says so, because a destination list built from it alone would
   silently omit the files the sidebar is still naming, which is what Q5 rejects.
   `destinationsOf(documents, views)` takes both lists for that reason.
3. **The create and delete wrappers already forwarded their `baseRevision`** (step 1, first review
   round's second finding). What step 2 owed was to hand them the *submission's* base rather than the
   window's: `MatchCreator` passes `matchCreation.baseRevisionOf(started.session)` and `MatchDeleter`
   passes `matchDeletion.baseRevisionOf(started.session)`, and both are asserted in the mounted
   suites against a window projecting something else.
4. **Nothing in this step writes `selected`.** The three direct assignments in
   `workspace.svelte.ts` are still `replaceSelection`'s own, `open()`'s and `select()`'s — the
   invariant and its two documented exceptions, unchanged. The two counters were not touched and are
   still two: a per-document `projectionGenerations` and the global `selectGeneration`.

### 2.8 D8 — a defect the mounted test found, and the model tests could not

`startMatchDeletion` drafted `match.id` directly, and `Draft`'s snapshot rule is `structuredClone`,
which **throws** on a reactive proxy. Every identity a screen holds comes out of `BrowserState.views`,
which is `$state` and therefore deeply proxied — so opening a deletion from a real window threw a
`DataCloneError` while the whole of `matchDeletion.test.ts`, which passes plain fixtures, stayed
green. `startMatchDeletion` now copies the three fields into a plain object and drafts that; the copy
also makes the session's identity independent of a projection replaced under it.

**This is the point of the mounted test, stated as an event rather than as a principle.** It is the
only defect in this step that no model test could have failed for, and it would have reached the
window reading as a blank pane. Deletion is the one place in this application that drafts a value read
straight off a projection — `matchEditor` and `matchCreation` draft objects their own models build —
so it is the one place the rule bit.

### 2.9 D9 — the destination list is bounded and the action row is sticky (added 2026-08-03)

**A defect the window reading found, and the one class of defect only a window can find.**
`2c-3a-2-window-reading.md` §7.2 measured the creation form at **805 px inside a 645 px pane** at
eight files, with *Add this snippet* at y = 813 — below the fold the moment the screen opened — and
the body's line-ending disclosure below it. The cause was the **unbounded destination list**: one full
control per listed file, so the form's height scaled with the workspace and the owner's thirteen
files would have been worse than the eight that were measured.

Two rules in `MatchCreator.svelte`, and both are layout:

- **`.destinations` gets `max-height: 12rem; overflow-y: auto`.** The list's height stops depending
  on the file count; what changes with the count is how far it scrolls.
- **The action row gets `position: sticky; bottom: 0`** with an opaque background, and the create
  control and the sentence saying why it is disabled are wrapped into **one** block — a control
  pinned to the bottom with its reason left above the fold would have stopped saying why.

**Nothing is hidden and no refusal is truncated.** Omitting a file, shortening a refusal or making one
unreachable would reintroduce exactly the finding the consult's Q5 exists to prevent, which is worse
than the defect being fixed; §12.5 of the reading is the measurement that all eight are still in the
list with all five refusals whole, and that the five not initially in view are reached by scrolling
the list itself.

**No new string, no new condition and no new model code.** There is no `if` about what may be created
or when a save may start, which is what keeps this component the rule-free walk §1 says it is; a
bounded list needs no sentence of its own because nothing about *what* the list contains changed.

**Re-measured in a window, not reasoned about** — `2c-3a-2-window-reading.md` §12, six launches, none
failed. At eight files the create control is at **y = 594** with the pane no longer scrolling at all
(`scrollHeight` 645 against `clientHeight` 645, where it was 819 against 645); at **fourteen** files it
is at the same y = 594 and only the list's `scrollHeight` moves, 390 → 570. The Spanish form fits with
**13 px** of margin, which §12.7 states as 13 rather than as "comfortably", and §12.8 is the launch
that made the form overflow anyway — 824 px inside 617 — to see the sticky row hold the control at
y = 624, on screen.

---

## 3. Verification

| Command | Result |
|---|---|
| `npm run check` | exit 0 — 403 files, **0 errors, 0 warnings** |
| `npm test` | exit 0 — **1160 tests over 42 files**, from 1116 over 40 |
| `npm run build` | exit 0 — **165 modules**, from 161 |
| `cargo test --workspace` | exit 0 — **1008 passed, 0 failed**, unchanged |

**The module guard is rebaselined to 165, and the rebaseline was measured rather than assumed.** A
pristine `git archive HEAD` copy built with the same `node_modules` transforms **161**, so the delta
is **+4** for two new components. That is not "two components, four modules" hand-waved: removing
`MatchDeleter.svelte`'s `<style>` block from a scratch copy and rebuilding gives **164**, so a
`.svelte` file with a scoped style contributes its own module *and* the virtual CSS module Vite
derives from it — two each, 161 + 4 = 165. The bundle contains no `svelte/internal/server` and no
`node:async_hooks`, so this is new modules and not the `resolve.conditions` regression, and
`vite.config.ts` is untouched.

**The forty-four new tests were counted per file rather than estimated**, by running the suite in a
pristine `git archive HEAD` copy and diffing: twelve in `MatchCreator.test.ts`, eight in
`MatchDeleter.test.ts`, seven in `matchCreation.test.ts`, five in `matchDeletion.test.ts`, two in
`workspace.test.ts`, two in `DetailPane.test.ts`, and **eight that no one wrote** — the three markup
scanners in `scripts/lint/` derive their cases per `.svelte` file, so two new components add two to
`hardcoded-strings`, two to `built-translation-keys` and four to `ipc-detail`. The fifty-one new
dictionary keys add **no** test of their own: `dictionaries.test.ts` walks the two files inside a
fixed number of cases.

---

## 4. Holes this step leaves open

1. **No window reading.** The third of `2c-split-notes.md` §7's three kinds of evidence is **not** in
   this record and is owed before 2c-3a can be called complete. The two `DetailPane.test.ts` cases
   establish that both screens are *reachable from the pane's markup*, which is not the same claim
   and does not stand in for one. A green suite is not a screen
   (`1c-1-notes.md` hole 1, and 2c-1b's own conclusion): jsdom has no layout and no WebKit, and a
   mounted test proves a handler fires, not that a window draws. §2.8 is this step's own instance of
   that gap one level down. The technique is `1c-1-notes.md` §10; the WKWebView constraint —
   **one plan per launch, into a fresh bundle path** — is `1c-2b-2b-2-notes.md` §6.1; and the language
   must be set **through the picker**, because the webview's `localStorage` follows the bundle
   identifier (`2c-2-2-window-reading.md` §1.2).
2. **The confirmation depends on a caller passing a live reader**, and nothing enforces it (§2.2). One
   caller exists.
3. **The creation form's destination list is still a snapshot** (step 1's hole 11), and the only
   refresh is *Add another snippet*, which re-seeds. A file the window projects or re-projects while
   the form is open is not reflected in the list, though it *is* reflected in the position options,
   which read the projections on every render — so the two halves of the form are refreshed on
   different schedules. That is not a data risk, because the form's own base revision is what is
   sent and a moved file conflicts; it is an inconsistency a reader could notice.
4. **The `after` options are one flat `<select>` with no bound.** A file with two hundred snippets
   produces two hundred options and no way to search them. Nothing about correctness turns on it and
   no window reading has looked at it. **Still open, and it is now the only unbounded list in this
   form**: its sibling — the destination list, which the reading found pushing the create control off
   the screen — was bounded on 2026-08-03 (§2.9). A `<select>`'s popup is drawn by the platform and
   scrolls on its own, so it does not have the defect §2.9 fixed; what it has is no way to *find* an
   option among two hundred, which is a different problem and is untouched.
5. **The deletion panel is reachable only for a snippet in a file this window projects**, because
   `startMatchDeletion` takes a `DocumentView`. A file whose read refused has no snippets to select,
   so the case is unreachable today — but the *absence* of the control carries no sentence, unlike
   every other withdrawal in this pane.
6. **`notInDocument` is unreachable from the running screen**, because `DetailPane.svelte` captures
   the snippet and its parse in one assignment. That is a fact about the caller as written, not a
   guarantee: `MatchDeleter`'s two props are ordinary values and a second caller could take them from
   two reads.
7. **A conflict is terminal in both screens**, with *Keep editing* as the only way out — step 1's
   hole 4, unchanged, because the alternatives are 2c-4a's and a rough version here would make that
   phase look already done. Neither screen offers, or may offer, a control called *keep my draft*.
8. **`confirmationRefused` is component state a model test cannot reach.** It reflects
   `confirmDelete` answering `null` and decides nothing, but it is the one piece of screen state in
   either component that the value modules do not own.
9. **The new-snippet opener lives in the third pane**, beside the raw-text toggle, and the middle pane
   — which is where a person looking at a list of snippets is looking — has no *add* affordance. That
   is a choice and not an oversight, but whether it is *findable* is exactly the kind of claim only a
   window reading can make.
10. **The Spanish sentences are checked by the parity tests and the untranslated-value heuristic
    only**, which is `2c-1b-notes.md` §8.8 unchanged. **Fifty-one** new ones were written this step —
    counted off the diff (`git diff -U0 src/lib/i18n/es.json`, fifty-one added lines and every one of
    them a key), because this figure disagreed with §1 and §3 until the review's second finding
    caught it and the disagreement was a count nobody had checked. The English file adds the same
    fifty-one, which is what `ExactDictionary` forces.
11. **`browser.rawEditor.discardWarning` still says *"Your changes have not been written to the
    file"***, which is false after a `mayHaveWritten` send failure. Untouched here because this step
    does not touch the raw editor and changing its markup obliges a re-take of 2c-1b's window
    reading. Whichever sub-phase next touches it owes it.
    **The two new screens' own twins were written the other way round** and say only what is true:
    `browser.matchCreation.discardWarning` says leaving discards what is in the boxes, and neither
    it nor `browser.matchDeletion`'s sentences claim anything about what is on disk.
12. **`BrowserState.moveMatch` still carries its three latent shapes** — a `SaveResult | null` return,
    a stale projection left installed when its own re-read fails, and `forgetFileText` where
    `forgetTextOf` belongs. It has no production caller; they are 2c-3b's, for the reason step 1's
    hole 8 gives.
13. **The raw-text toggle is not withdrawn while the new screens are open**, though both new openers
    are. Its condition is `editing === null` and was left exactly as it was, because widening it
    would also change what the *small editor's* screen draws and oblige a re-take of a reading this
    step is not taking. The consequence is cosmetic — the four write surfaces outrank the viewer in
    the `{#if}` chain, so the toggle changes nothing while one is open — and it is an inconsistency a
    window reading would be right to flag.
14. **A component can still bypass both wrappers.** `src/lib/ipc/commands.ts` exports `createMatch`
    and `deleteMatch`, and nothing stops a `.svelte` file importing them directly and skipping the
    adoption, the confirmation and the selection repair. **No component imports that module at all
    today**, which was re-checked this step and is still a fact about the code rather than a
    guarantee.
