# Phase 2c-4a-3a — decision record

**The conflict panel is drawn on the two authored-text match surfaces: both sides, both
revisions, a two-step reload and a labelled reference copy.** 2c-4a-2 built every transition
and offered none of them; this step flips `offersCopyDraft` and `offersReload` on
`matchEditor.ts` and `matchCreation.ts` and gives `MatchEditor.svelte` and
`MatchCreator.svelte` the controls, the comparison and the copy. **The other three match
surfaces are untouched** — the mover, the deleter and the duplicator still declare
`offersReload: false`, which is 2c-4a-3b's boolean to flip.

The authority for this step is `docs/reviews/phase-2c-4a-design.md`. It discharges its **Q3**
for two of the six surfaces, its **Q4** in full (a labelled, non-YAML reference copy for
`MatchBuffers` and `CreationBuffers` and for nothing else), and its **Q5** for those two
panels. Where this record and that document disagree, the consult is right and this is a bug.

**One review round, `docs/reviews/phase-2c-4a-3a-code.md`: two Highs, four Mediums and a Low, all
accepted and all fixed.** Three of the seven were sentences claiming something the code does not
do — this project's named worst defect class, written by this step — and one of them could have
cost a person their draft. §7 is the disposition of each. Two of the fixes reach past the two
panels: the shared reload machinery gained a terminal *refused* step that all six surfaces write,
and `RawEditor.svelte` lost its duplicate clipboard routine and now walks the same disk-text
model as the new panels.

**No Rust, no window reading, and no cross-revision identification.** The reading belongs to
step 3's exit (consult Q8) and is owed once all five panels exist; nothing here identifies
"the same snippet" across two revisions, which is 2c-4b's confidence work.

---

## 1. What this step built

*Everything below describes the code **after** the review of §7, whose seven findings all
needed changes. What each finding changed is §7; what the code now does is §1 and §2.*

| File | What changed |
|---|---|
| `src/lib/browser/saveOutcome.ts` | `DraftFieldStatus`, `RetainedDraftField`, `DraftCopyWording`, `referenceCopyOf()`, `draftFieldStatusKey()`; **`ConflictReloadOutcome` and a required `reloadOutcome` on `ConflictCapabilities`**, which decides the conflict panel's reload sentence; **`ConflictDiskText` and `conflictDiskText()`**; a `reloadClosesSurface` message; `ConflictReloadStep` gains `unavailable` and `conflictChoicesFor` offers no reload label at it; both describers take the calling surface's capabilities |
| `src/lib/browser/editorSave.ts` | `ReloadStep` gains a terminal **`refused`** arm with `RELOAD_REFUSED`; `spendTheConfirmedReload` answers a three-valued `ReloadSpend`; `offeredReloadStep` maps the new arm; `atTheReloadWarning()` and `reloadWasRefused()` added |
| `src/lib/browser/matchEditor.ts` | `CONFLICT_CAPABILITIES` → `offersCopyDraft: true, offersReload: true, reloadOutcome: 'closesSurface'`; `statusOfIntent()` and `retainedDraftOf()`; `retainedDraft`, `reloadUnavailable` and `diskText` on the view; a refused spend writes `RELOAD_REFUSED` |
| `src/lib/browser/matchCreation.ts` | the same, over its two fields |
| `src/lib/browser/matchDeletion.ts`, `matchMove.ts`, `matchDuplication.ts` | `reloadOutcome: 'closesSurface'`, the refused-spend arm and the two new view fields. **`offersReload` stays `false`** and no component of theirs changed: they cannot reach the new arm, which is what made adding it here safe |
| `src/lib/browser/rawEditor.ts` | `reloadOutcome: 'reseedsDraft'`; the refused-spend arm; `reloadUnavailable`; `diskText` becomes a `ConflictDiskText` |
| `src/lib/components/clipboard.ts` | **new module**: `copyReferenceText()`, the clipboard routine **moved** out of `RawEditor.svelte`, with the carriage-return rule of §2.4 |
| `src/lib/components/MatchEditor.svelte` | the conflict panel — retained draft, disk text, the confirmation sentence, the refused-reload disclosure, the copy disclosures — and a `copyDraft` arm that acts |
| `src/lib/components/MatchCreator.svelte` | the same panel over its two fields, plus the `h3`/`.shownValue` rules it had no need of before |
| `src/lib/components/RawEditor.svelte` | its 130-line clipboard routine replaced by the shared one; it walks `ConflictDiskText`; it draws the refused-reload disclosure |
| `src/lib/i18n/index.ts` | `tDraftFieldStatus()` and `tDraftCopy()` — the one adapter between the copy's format and its sentences |
| `src/lib/i18n/{en,es}.json` | **thirteen new keys** in each, at parity (§2.5) |

Tests added or changed:

| Where | What it pins |
|---|---|
| `saveOutcome.test.ts` — the reference copy (**new**, 4 cases) | the heading first, one block per field in the order given, **every copied string byte for byte** including a carriage return and trailing spaces, the empty-draft shape, and a phrase for every status in both languages |
| `saveOutcome.test.ts` — what each surface offers (**rewritten**) | three surfaces now offer all three choices at both steps; three offer `keepEditing` alone. It still imports no component and still says so. The case that pins the six `draftKind` declarations is untouched |
| `saveOutcome.test.ts` — the surface-aware warning (**new**) | the raw editor's conflict says *replaces your text*, the five match surfaces' says *closes this panel*, and no surface gets both — plus the six `reloadOutcome` declarations |
| `saveOutcome.test.ts` — the refused step (**new**) | `unavailable` names neither reload label and keeps *Keep editing* and the copy |
| `matchEditor.test.ts` (**2 new**, 3 rewritten) | the retained draft's labels, exact texts and statuses; a drafted removal keeps its text and says `removing`; the three offered choices; the second step's `confirmReload`; **a refused spend leaves a terminal step that offers no reload and cannot be spent twice** |
| `matchCreation.test.ts` (**1 new**, 3 rewritten) | the retained draft is the two typed strings and nothing about the destination; the same two choice lists; the same refused-spend claims |
| `matchDeletion.test.ts`, `matchMove.test.ts`, `matchDuplication.test.ts` (1 rewritten each) | the refused-spend arm on the three surfaces that do not offer it |
| `rawEditor.test.ts` (2 rewritten) | the refused-spend arm and its choice list; `diskText` as a union, **with the empty-file arm** |
| `workspace.test.ts` (1 rewritten) | the adoption door's model is built with a surface's declaration |
| `MatchEditor.test.ts` (mounted, **7 new**, 1 rewritten) | both sides on screen with all three revisions substituted; the adoption count is zero at the panel, zero at the warning and one after the confirm click, with `close()` called once; `installed`/`alreadyThere`/`refused` treated as two successes and one refusal; **the copy's clipboard text compared exactly against `tDraftCopy` of the expected fields, recorded from the carrier's selection**; a draft holding a carriage return refuses the selection route and says so; the refused reload's disclosure and vanished control; the surface-aware warning |
| `MatchCreator.test.ts` (mounted, **6 new**) | the same claims over the creator's two fields, plus *no second command was sent* |
| `RawEditor.test.ts` (mounted, **1 new**) | the refused reload's disclosure, its vanished control, and a draft that was not reseeded |

**1380 → 1404 frontend tests over 46 files.** `npm run build` reports **172** modules — 171 plus
the one new source module — with no `svelte/internal/server` in the bundle. No Rust was touched.

---

## 2. The decisions

### 2.1 D1 — the panel is a walk, and the retained draft is a model value

`MatchEditorView.retainedDraft` and `MatchCreationView.retainedDraft` are `RetainedDraftField[]`:
a label as the detail pane's own `DetailFieldName`, the buffer's exact text, and a
`DraftFieldStatus`. The components walk that list and call `tDetailField`, `tDraftFieldStatus`
and `SourceText`; they decide nothing about which fields appear, in what order, or what is said
about them.

**The reason is narrower than "markup cannot be tested"** (2c-3c-3's Medium): a *model* test
drives values and never markup, so a rule written into one renderer is carried by that
renderer's mounted suite alone — and here there are two renderers, which is exactly the shape in
which one of them silently omits the rule.

**It is built from the conflict's own retained draft**, through `copyOfDraft(conflict)`, never
from the session's live buffers. The two are equal today because a conflict refuses every edit
until it is dismissed; writing it from the session would make the panel describe something else
the first time that stops being true, and nothing in the type would notice.

**The panel draws the copy's own list, so what a person is told they copied is what they were
shown.** That invariant is why the match editor draws all six fields — including the three
word-boundary keys, usually empty — rather than the interesting ones: filtering the *panel* and
not the *copy* would break it, and filtering both would drop drafted values the consult's Q4
requires the copy to carry. The cost is six boxes where two or three would read better, and it
is a presentation cost a window reading may want to revisit; it is not a correctness one.

### 2.2 D2 — the status is what a save would do, not whether the key is present

The consult's Q4 asks for "an explicit present/marked-for-removal status". **A two-valued
present/removed status could not be written truthfully**: an initially absent field left blank
sends `'Unchanged'`, so calling it *present* — or *this text would be written* — states the
opposite of what a save does, and that rule is the one the whole draft-versus-projection
arrangement exists for (`matchEditor.ts`'s `fieldIntent`).

So `DraftFieldStatus` has the three arms of the wire's own `DraftField<T>` — `unchanged`,
`setting`, `removing` — and `statusOfIntent()` maps `fieldIntent`'s answer onto them. A removed
field keeps its text in its buffer and is copied with it, which is the half of Q4 that says
dropping either the text or the flag would not preserve the drafted value.

For the creator both fields are `setting`, and that is a fact rather than a default: a create
writes both keys, and there is no key there to leave alone or to take out.

**What no type forces**, in the same sentence as what one does: `statusOfIntent` is total over
`DraftField<string>`, so a fourth arm of that wire type would fail to compile here — and nothing
requires the *panel* to draw the status beside the value it describes. Both renderers do, and
both mounted suites read it.

### 2.3 D3 — the format is in the model, the sentences are in the dictionary, and one adapter joins them

`referenceCopyOf(fields, wording)` in `saveOutcome.ts` owns the shape: the heading first, then
one block per field — its label and status on one line, its text under them — joined by blank
lines, in the order the caller gives. `tDraftCopy(fields)` in `src/lib/i18n/index.ts` is its
**only** caller and supplies the three localized pieces.

That split is what makes *the copy preserves every string exactly* a claim a test can fail on:
`saveOutcome.test.ts` drives the format with wording it can read back, so the assertion is about
the assembly and not about English. **Both components call `tDraftCopy` and neither holds a copy
of the format**, so they cannot drift from each other.

**It is never YAML**, and the heading says so in both languages (checked). Emitting YAML from a
projection drops comments, key order and scalar spelling while looking like something that could
be pasted back into a configuration file — the preservation-promise mistake 2c-3c exists to
prevent (`CLAUDE.md` §6).

### 2.4 D4 — the clipboard technique is shared, and it refuses one route rather than altering bytes

`src/lib/components/clipboard.ts` is the raw editor's routine — the asynchronous API first, the
offscreen-carrier selection fallback second, every restoration step separately non-throwing —
moved into a module all three write surfaces call.

**One rule is added, and it is the reason a copy on these surfaces is not the raw editor's
copy.** A `<textarea>`'s API value has every line break normalised to LF; the raw editor may
ignore that because it refuses to hold a text containing a carriage return at all, but a *match*
buffer legitimately holds one — a projected value with a real `\r` is seeded into its buffer,
shown read-only, and never sent. So `copyReferenceText` **refuses the carrier route for any text
holding a carriage return** and reports failure, rather than putting different characters on the
clipboard and reporting success. A mounted case drives exactly that path and asserts
`document.execCommand` is never reached.

**A refused copy is a real loss, and the sentence beside it must not pretend otherwise** — the
review's finding 1, and §7.1. `navigator.clipboard.writeText` is the only route that could
preserve a carriage return, and whether the shipped webview grants it at all is unsettled; there
is no second CR-safe route to fall back to, and inventing one on an untested assumption would be
this project's worst defect class. So the disclosure says the copy failed, says that the panel
writes the *name* of any character no font can draw in place of the character, and says that
loading the disk version discards the draft either way. It does **not** say the draft can be
recovered by selecting the panel.

**`RawEditor.svelte` was migrated onto this module** — reversing this step's first decision, and
the review is why. Three of its findings sent changes into that component anyway (the refused
reload, the disk-text union, and the doc that described the wrong return contract), and once it
was being edited, keeping a second copy of a routine whose failure mode is *silence* was the
worse of the two risks. The consequence is stated rather than hidden: **that component's window
reading is now owed again**, and step 3's reading must cover the raw editor too (§4.2).

### 2.5 D5 — thirteen keys, and the shared warning is now surface-aware

Eleven shared keys under `browser.saveOutcome.` — the two headings, the three statuses, the
copy's on-screen disclosure, the clipboard heading, the copied/failed sentences, **the
match-surface reload warning** and **the refused-reload disclosure** — plus one per surface for
the confirmation step: `browser.matchEditor.reloadClosesEditor` and
`browser.matchCreation.reloadClosesForm`.

**The shared warning was false on five of the six panels, and that is the review's finding 2.**
`browser.saveOutcome.reloadDiscardsDraft` — drawn in every conflict panel since 2c-1b — says
*loading the version on disk replaces your text with it*. That is the raw editor's behaviour. On
a match surface the reload installs the disk **projection** and **closes** the panel: nothing is
loaded in the draft's place, because there is no truthful disk-side `MatchBuffers` or
`CreationBuffers` and manufacturing one would be 2c-4b's identity work. This step's first round
left the shared line alone and put a true sentence *beside* it, which produced a panel that said
both things at once.

**The fix is a declaration, not a second sentence in markup.**
`ConflictCapabilities.reloadOutcome` is required, so a surface cannot omit it and inherit
somebody else's claim, and `describeConflict` picks `reloadDiscardsDraft` or
`reloadClosesSurface` from it. The raw editor declares `reseedsDraft`; all five match surfaces
declare `closesSurface` — including the three that do not offer the reload, for whom the old
sentence was equally false. **What no type forces** is that a surface's transition really does
what it declares; what it does force is that the sentence and the declaration cannot disagree
across surfaces, and each surface's own suite drives its transition.

The two per-surface confirmation sentences were then cut back to what only they can say: the
editor's says this application will not guess which snippet corresponds across revisions, and
the creator's says a file on disk holds no half-written snippet — and, since the review's
finding 6, that the form **closes** and a form opened afterwards starts empty, which is what the
code does.

### 2.6 D6 — the disk side is the whole file, and nothing is identified across the two

`conflict.diskText` through `SourceText`, exactly as `RawEditor.svelte` draws it, with
`documentStart` so a BOM is named. The consult's Q5 ranking, unchanged: the whole text shows
what is there without claiming an identity survived, and a "same match" from the disk projection
would silently pick the wrong snippet after an external insertion, reorder, edit or duplicate.

Both panels keep the three revision lines they have had since 2c-2 — expected, found, disk —
and the mounted suites now assert each with its own digest substituted, so the three are three
statements rather than one repeated.

**A file of zero characters is `ConflictDiskText`'s `empty` arm, decided once**, and that is the
review's finding 5. This step's first round wrote `diskText === ''` into two new renderers
because `RawEditor.svelte` already wrote it, which made *an empty file is a fact about the file
rather than a failure to obtain its text* — 2c-4a-1's D1, a semantic claim — a decision carried
by no suite at all. `conflictDiskText()` in `saveOutcome.ts` is now the only place it is made,
all three components walk the union, and `rawEditor.test.ts` drives the empty arm. **What no
type forces** is that a component draws something for each arm; what it forces is that neither
arm can be reached without asking the model which one it is.

---

## 3. What this step deliberately did not do

- **No `saveAnyway`, no retry of the stale candidate, no automatic reload, no clearing of dirty
  state on conflict, no cross-revision identification, no YAML from a projection, no diff.**
  Forbidden for the whole of 2c-4a (consult Q1 and its verdict).
- **No control named or coded "keep my draft"**, in either language. Checked in both
  dictionaries, and the new copy heading is checked for it too.
- **No control was drawn on the mover, the deleter or the duplicator.** All three still declare
  `offersReload: false`, their `copyDraft` stays refused by `conflictChoicesFor` whatever they
  declare (the Q4 rule is about what their draft *is*), and none of their components changed.
  Their **models** did: the shared reload machinery grew an arm and the capability record grew a
  required field, so all three carry both. They cannot reach the new arm — no control, no
  confirmation, no spend — which is exactly what made changing shared machinery here safe rather
  than a change to three panels in flight (§7.3).
- **No Rust**, no change to `src-tauri/` or `crates/`, and no `cargo` gate is owed.
- **No window reading**, which belongs to step 3's exit once the remaining panels exist.

---

## 4. Holes this step leaves open, each with its reason

1. **The match editor's panel draws all six fields**, three of which are usually empty boxes
   (§2.1). A presentation cost, not a correctness one, and a window reading is the right place
   to judge it.
2. **`RawEditor.svelte`'s window reading is owed again.** It lost its clipboard routine, walks
   the disk-text union and draws a new disclosure (§2.4), so step 3's reading must cover the raw
   editor and not only the two new panels.
3. **Nothing relates a `CONFLICT_CAPABILITIES` declaration to the component that draws it.**
   Unchanged from 2c-4a-2 §4 hole 4 — the two booleans are prose-and-test, not a type; the third
   field, `reloadOutcome`, is at least *required*, so a surface cannot silently inherit another's
   sentence. What is new is that all three live components' mounted suites now press every
   control their model offers, which is the wiring evidence that test could never be.
4. **The three unoffered surfaces have a refused-reload state their panels do not draw.** Their
   views carry `reloadUnavailable` and nothing reads it, because nothing on those screens can
   produce it. 3b draws it in the same change that flips their boolean; until then the field is
   the same kind of unreached-but-built as their reload transition has been since 2c-4a-2.
5. **`browser.matchMove.refused.unsavedDraft`'s known defect is untouched**, as it has been since
   2c-3c: its sentence claims unsaved edits where its predicate measures an open editor.
6. **A draft holding a carriage return cannot be copied at all if the clipboard API is denied**,
   and the disclosure says so rather than offering a route (§2.4). Whether the API is denied in
   the shipped webview is unsettled (`2c-1b-notes.md` §9.11.4); if a reading establishes that it
   is, this becomes a real gap for those drafts and the honest answer is a Tauri clipboard
   plugin, which is a dependency plus Rust and therefore its own decision.
7. **No window reading, and the copy is the part that most needs one.** jsdom is not WebKit, so
   what these suites prove is that the *fallback* runs, selects the whole carrier and carries the
   right bytes when the API is absent.

---

## 5. The mounted-component evidence

Every sub-phase of 2c owes model tests, a mounted-component test and a window reading. The first
two are here; the third is step 3's exit and is not owed by 3a alone.

`MatchEditor.test.ts` and `MatchCreator.test.ts` — both already `@vitest-environment jsdom` —
gained a recording `adoptDiskVersion` prop and an injectable answer, so a case can watch
*when* the window is asked to move and what it does with each of the three answers. Between them
they press every control the two panels draw: *Keep editing*, *Copy my text*, *Load the version
on disk* and *Discard my text and load it*. `RawEditor.test.ts` gained the same injectable
answer and a case for the refused reload.

**The clipboard cases record the carrier's *selection*, not its value**, since the review's
finding 4, and the falsifiability was proved by mutation rather than asserted: deleting
`carrier.select()` and `carrier.setSelectionRange(...)` from `clipboard.ts` turns both copy cases
red — *copies a labelled reference of the draft, and never YAML*, in each suite — and restoring
them turns them green. Each compares the recorded selection against `tDraftCopy` of the exact
fields the case's own projection and edits produce, so the labels, the order, the statuses and
every string are pinned in one equality.

**What they prove and what they do not**: that a handler fires, that the right value reaches the
boundary and that the right sentence is on the element. jsdom has no layout, no WebKit and not
necessarily WebKit's clipboard behaviour — so *the panel is legible*, *the copy reaches the
system clipboard* and *the disk text is readable beside a long draft* are all a window reading's
to establish.

---

## 6. The gates

| Command | Result |
|---|---|
| `npm test` | exit 0 — 46 files, **1404 passed** (baseline 1380) |
| `npm run check` | exit 0 — 412 files, **0 errors, 0 warnings** |
| `npm run build` | exit 0 — **172 modules**, 171 plus one new source module; no `svelte/internal/server` in the bundle |
| i18n parity | **711 keys** per language (baseline 698), key sets equal, placeholders equal, no Spanish value left identical to its English one |

`cargo` was **not run and is not owed**: no file under `src-tauri/` or `crates/` was modified.

Acceptance greps:

```sh
rg -n 'offersReload' src/lib/browser/match{Move,Deletion,Duplication}.ts
# three hits, all `offersReload: false` — the three surfaces 3b owns.

rg -n 'copyDraft' src/lib/components/Match{Editor,Creator}.svelte
# the arm calls `copyTheDraft()`; there is no `return` that does nothing.
```

---

## 7. The review

`docs/reviews/phase-2c-4a-3a-code.md` — Codex, aggregate, READINESS: **NOT READY**, two Highs,
four Mediums and one Low. **All seven are accepted and none is disputed.** Six were closed by the
fix round; the seventh needed a second round, and §7.8 records why. Its clean
categories are recorded unchanged: `alreadyThere` treated as success, the origin-bound adoption
protocol not bypassed, no stale retry or automatic reload or YAML emission or diff or
cross-revision identification or *keep my draft*, `conflictChoicesFor` still the sole choice-list
producer, the three unoffered surfaces' controls untouched, i18n at parity through accessors, and
no byte-span or UTF-16 indexing defect introduced.

**Three of the seven were this project's named worst defect class** — a sentence claiming
something the code does not do — and all three were sentences *this step wrote*.

### 7.1 High — the failed-copy sentence promised a hand copy the renderer had already altered

**Accepted; the behaviour was examined first and the sentence changed second.** `SourceText`
replaces every character no font draws — a carriage return, a NUL, a zero-width space, a BOM —
with its *localized name* (`sourceText.ts`, "the one transformation this module does make"), so
*it is shown above exactly as it is held, so it can be selected and copied by hand* was false
precisely for the drafts whose copy had just failed. A person could have taken the altered text
and then confirmed the reload.

**A CR-safe fallback was looked for and none can be claimed.** `navigator.clipboard.writeText`
takes the string as it is and is the only route that could preserve one; the carrier is a
`<textarea>`, which normalises. A `contenteditable` carrier was considered and rejected: whether
WebKit's clipboard serialization preserves a carriage return out of a DOM text node is not
established, jsdom cannot establish it, and shipping an unverified route that reports **success**
would be a worse instance of this very finding.

So the sentence now claims only what is true: the copy failed; the panel writes the *name* of any
character no font can draw instead of the character, so selecting it by hand does not always give
back what was written; and loading the disk version discards it either way. Both locales, and the
three code comments that carried the same false promise (`MatchEditor.svelte`,
`MatchCreator.svelte`, `clipboard.ts`). **The raw editor's own `draftCopyFailed` sentence still
says the text can be selected from the box, and that stays** — its box is a `<textarea>` holding
the draft itself and that editor refuses to open any text containing a carriage return, so the
claim is true there and `RawEditor.svelte` says why in the same paragraph.

### 7.2 High — the shared conflict panel warned about a reload five surfaces do not perform

Accepted; fixed by declaration rather than by a second sentence. §2.5 is the record.

### 7.3 Medium — a spent confirmation the window refused stayed offered

**Accepted and fixed here rather than deferred**, which reverses this record's first version:
that one listed it as a hole for 3b, and the orchestrator's ruling is right that the three
surfaces which read the shared machinery declare `offersReload: false` and therefore cannot reach
the new arm — so adding it now is safe and leaves 3b only drawing it.

`ReloadStep` gains a terminal `refused` arm; `spendTheConfirmedReload` answers `satisfied` /
`refused` / `notAttempted` instead of a boolean, because *nothing was spent* and *the window said
no* are different facts and the second is terminal; `offeredReloadStep` maps it to
`ConflictReloadStep`'s new `unavailable`, at which `conflictChoicesFor` names **no** reload label
and keeps *Keep editing* and the copy. All six surfaces write `RELOAD_REFUSED` on a refused
spend, all six views expose `reloadUnavailable`, and the three live components draw the
disclosure. **The raw editor was included**, because it ships and could reach the same dead
control; the cost is §4.2.

**What no type forces**, in the same sentence as what one does: nothing requires a surface to
write `RELOAD_REFUSED` back rather than returning its session unchanged, and each surface's own
suite is what drives that — six cases, one per surface, each also asserting that a second press
asks the window nothing.

### 7.4 Medium — the clipboard mocks read the carrier's value, not its selection

Accepted, fixed, and **proved by mutation** rather than asserted (§5).

### 7.5 Medium — two renderers each decided what an empty disk text means

Accepted; `ConflictDiskText` and `conflictDiskText()` are the model's answer, and the raw editor
was moved onto them so the rule has one shape rather than three. §2.6 is the record.

### 7.6 Medium — the creator's warning said the form restarts empty, and it closes

Accepted. The sentence now says the form **closes** and that a form opened afterwards starts
empty, which is what `reloadTheDiskVersion` and `MatchCreator.svelte`'s `close()` do.

### 7.7 Low — the clipboard doc described a return contract the code does not have

Accepted. Cleanup failure is swallowed and does not change the answer, and the doc now says that
and why: reporting a successful copy as a failure because a carrier would not detach would send a
person to hand-copy text they already have.

### 7.8 Round 2 — the confirmation pass, and the narrower instance it found

The fix round was itself reviewed, by the standing rule that **a fix is a change and the round that
reviews it is not optional**. Round 2 (`phase-2c-4a-3a-code.md`, second half) closed six of the
seven, found **no new defect introduced by the fixes**, and left §7.1 **partially closed**: the
user-facing sentences and the production comments were corrected, but two *test comments* in
`MatchEditor.test.ts` still carried the framing §7.1 had rejected — "the panel still shows every
byte", and the localized representation called "the value … on screen for a manual selection".

That is exactly the pattern `2c-4a-2-notes.md` §7.6.2 names: a fix closes a finding and leaves a
**narrower instance of it standing**, because the sweep was written from the old wording. The
comments are now written against what `SourceText` does — it shows a *readable representation* with
the carriage return named, explicitly not the original value, and no route on that panel recovers
the original.

Round 2 also recorded a limit worth carrying forward: **no executable test pins the semantic wording
of `draftCopyFailed`, `reloadClosesForm` or the clipboard JSDoc.** Reverting those prose fixes while
keeping the same keys leaves every suite green. The i18n suites check parity and placeholder
agreement, not meaning, so what those sentences *claim* is confirmable only by reading them.

### 7.9 What this round leaves for the next reviewer

The two things most worth attention are **§2.2's status mapping** — a status that is a claim
about what a save writes — and **§7.3's terminal step**, which is new shared machinery reached
today by three surfaces and, from 3b, by six.
