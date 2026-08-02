# Phase 2c-1b — decision record

**The raw editor: the first screen in this project that can write a user's file.**

Phase 2c's split (`docs/decisions/2c-split-notes.md`) cuts it by failure mode, and 2c-1b is the
sub-phase that fails as a **protocol mistake**. It is the one vertical slice: the raw pane made
editable and saveable over the already-wired `saveRawDocument`, the three outcome arms drawn, the
acknowledgement round trip drawn, the terminal-but-honest conflict state, and this project's
**first mounted-component test**.

Five things it owed, from `PROGRESS.md` § "Next action": the eight requirements of the split's §6
with the prohibition attached, the mounted-component test, a window reading, the raw-save subset
of the never-drawn strings, and a decision on hole 4.2 — whether the seal is useful at a real call
site. **All five are here.** The window reading was taken last, against the fixed code, and it is
§9; it found two things no test in this project can see (§9.10.1, §9.10.2) and was then re-taken over
the fixes for them (§9.11).

**No Rust was written and none was needed.** Nothing under `crates/` or `src-tauri/` is touched.

**This document has been written five times, and every rewrite was a defect found.** The aggregate
code review (`docs/reviews/phase-2c-1b-code.md`) returned **`READINESS: NOT READY`** on three High
findings and three Medium. Five were code, and **two of them were data-loss paths this record had
argued were closed** — §5 claimed a bound the code did not have, and its §8.3 recorded as an accepted
hole something that was simply a screen not being told. All five are fixed; §12 records what was
wrong. The sixth was the window reading, which was then taken (§9) — and **it found a data-corruption
defect that five automated suites and a code review had all missed**: a text area silently normalized
CRLF, so a raw save of a CRLF file rewrote every line ending in it. That is D13. The reading also
measured the clipboard refusing to copy, which is D14. Both were recorded as holes when the reading
was written and are decisions now. Those two fixes were then reviewed on their own and came back
**`READINESS: NOT READY`** again, on one High and one Medium — **and the High was this record
overclaiming for the third time**, saying TypeScript forced an invariant that a run-time check held.
§12.7 and §12.8 record both; D13 now separates what the type system enforces, what the run-time
guards enforce, and what merely happens to be true of one component.

**And then the reading was re-taken over what those fixes changed** (§9.11, five launches), because
the rule that a claim about a screen needs a reading of a screen binds a fix as much as a feature.
The CRLF refusal is on screen in both languages over the committed corpus fixture, with the fixture's
bytes checked afterwards — and the re-take **withdrew one of the first reading's own conclusions**:
both runs were taken with the machine's screen locked, so the clipboard's refusal says nothing about
this webview. That is hole 8.12, and it is the one thing in this phase that needs a human at an
unlocked machine rather than another automated pass.

---

## 1. What this phase built

- **`src/lib/browser/rawEditor.ts`** — the editor's state machine over a `Draft<string>`: the
  session, the transitions, and one derived `RawEditorView` a screen reads. It **uses** 2c-1a
  rather than restating it — `draft.ts` for the draft and its consent, `saveOutcome.ts` for the
  three arms, `rawSave.ts` for the parse rejection, `invalidation.ts` for the seal.
- **`src/lib/components/RawEditor.svelte`** — the walk over what that decides. A text area, an
  undo/redo/save row, and one panel per outcome arm.
- **`src/lib/components/DetailPane.svelte`** — the way in. The raw viewer gains an *Edit this
  file's text* control for a writable, projected file, and the editor branch is tested **before**
  the viewer's so that a click elsewhere in the window cannot discard a draft.
- **`src/lib/browser/workspace.svelte.ts`** — `saveRawDocument` now answers a typed
  `RawSaveAnswer` whose sealed arm carries what this state's own invalidation did (§3); the raw
  viewer's text is **paired** with the revision captured when its read started (`fileTextRevision`,
  §5); and `rawTextOf(document)` answers about a named file rather than about whatever the viewer
  is pointed at (§8.6).
- **`src/lib/browser/invalidation.ts`** — `sealWholeDocumentSave` takes the issuer's own
  invalidation status as a **required** third argument, and an opened seal carries it beside what
  the opener's own callback did.
- **`vite.config.ts`** — the `jsdom` decision, taken and scoped, with the comment that has held it
  open since 1b-1 rewritten to record it (§6).
- **`src/lib/i18n/index.ts`** — `tRawEditorRefusal`, the accessor over the one reason this editor
  declines to open a file at all (D13).
- **Twenty-six dictionary keys in both languages**, all under `browser.rawEditor.*`.
- **73 new frontend tests** — 38 in `rawEditor.test.ts`, 20 in `RawEditor.test.ts`, eight in
  `workspace.test.ts` and two in `invalidation.test.ts`, plus six the three lint sweeps add by
  themselves because four new files now exist under `src/` (`ipc-detail` scans every `.ts` and
  `.svelte`, the other two every `.svelte`). 821 → **894**.

---

## 2. The decisions, each with its reason

### 2.1 D1 — the editor's state is a value, and the component is thin

The idiom of every model in `src/lib/browser/`, and 2c-1a's D1 one layer up: `RawEditorSession` is
immutable, every transition returns a new one, and the component holds it in a `$state.raw` and
reassigns it. `$state.raw` rather than `$state` because a draft holds deep-frozen snapshots and a
reactive proxy has no business walking them.

What that buys is the thing this project keeps paying for: **nothing here renders a Svelte
component in the ordinary suite**, so a decision written in markup is a decision nothing can check.
The component is a walk plus five handlers.

### 2.2 D2 — the text is read-only while a save is in flight

`2c-1a-notes.md` §4.6 left this open and said 2c-1b should answer it deliberately. It is answered
**no**: a person gains nothing by typing into a box whose contents are already on their way to
disk, and the state it produces — a save boundary drawn behind the current position, or a draft
that undid past its own save — is one the spine can represent and nobody can describe.

`savedDraft` is still given the **submission** rather than the current value, so the rule stays
correct if this policy is ever relaxed.

### 2.3 D3 — the text is read-only while a conflict is showing

The conflict state is *terminal* (split §6), and its two labelled ways out are *Keep editing*,
which dismisses the panel and gives the box back untouched, and *Reload disk version*, which
discards the draft behind a confirmation. Freezing the box in between is not decoration: it is what
makes two of the eight requirements true rather than likely.

- `copyOfDraft(conflict)` copies the draft **as the conflict holds it**. If the box stayed live,
  *Copy my text* would copy the bytes that were refused while the person looked at different bytes
  on screen — the copy silently not being the text.
- A confirmation is issued for one conflict. If the box stayed live, the token would still be valid
  against text that changed after the warning was read.

### 2.4 D4 — one keystroke is one history step, and coalescing is refused rather than guessed

`2c-1a-notes.md` §4.5 records that `HISTORY_LIMIT = 100` was arithmetic rather than measurement and
that 2c-1b owes the coalescing decision. It is **not to coalesce**. What a person means by "one
edit" in a free-form text area is a guess, and a wrong guess silently loses undo steps they
expected to have; the bound's cost is the *oldest* step, which is the one undo is least about.

The consequence, stated rather than hidden: a hundred keystrokes fills the history, and after that
each new one drops the oldest. `baseValue` is never dropped, so "what this file held when I opened
it" survives regardless — and after a save, that is what was last written.

### 2.5 D5 — *Save anyway* is withdrawn the moment the text changes, and a sentence says why

The load-bearing half of the acknowledgement round trip, and the reason this phase has a mounted
test at all. A refusal is about **one exact candidate**: the gate matches the multiset of *that
text's* suspicions, and `DocumentDoesNotParse` carries *that text's* revision. Once the person
types, the findings on screen describe something that is no longer what would be written.

`acknowledgeRefusal` already refuses to record consent in that case, so a re-submission would carry
`EMPTY_ACKNOWLEDGEMENT` and simply be refused again. That is safe and baffling. So
`rawEditorView.refusalChoices` withdraws the offer at the same moment, and
`browser.rawEditor.findingsAreStale` says the findings are about text that has since changed — a
control that vanishes with no explanation is its own defect.

### 2.6 D6 — the acknowledgement is never assembled, only carried

*Save anyway* calls `acknowledgeFindings`, which is a thin call to `acknowledgeRefusal` — the only
producer of consent — and then `beginSave`, which reads it back through `submissionOf`. There is no
path in this module that builds an `Acknowledgement` from parts, and `acknowledgementOf` exists so
that the one place consent leaves for the boundary is a place this module can be searched for.

**What that does not force**, in the same breath: a caller could still read
`submission.acknowledgement` and pass it beside different text. TypeScript has no linear types.
This module never produces that pairing; the wire refuses it as a second refusal rather than
writing it (`2c-1a-notes.md` §4.1, unchanged).

### 2.7 D7 — a send that never left is not an outcome

`saveRawDocument` answers `null` when the *command* failed. That is not one of the three arms:
nothing was written, no findings exist, and no revision moved. The session raises
`browser.rawEditor.sendFailed` and leaves the draft exactly as it was, so the person may simply try
again. Drawing it as a refusal would invite them to look for findings that do not exist.

### 2.8 D8 — the conflict shows the disk version's own text, not only two digests

Split §6 asks for *enough file/revision information to tell the disk version from the draft*. Three
revisions are shown, in full and in the monospaced face, and so is the file's path — and beneath
them the disk version's **text**, rendered through the same `SourceText` the viewer uses.

That text is not read here. On a conflict the workspace already refreshes its own projection and
re-reads the file (`workspace.svelte.ts`, the conflict arm), so `browser.fileText` becomes the disk
version; `DetailPane` passes it to the editor as `diskText`. **It is passed in rather than derived
from the draft precisely so that the two cannot be confused**: the draft lives in the session,
nothing in the component writes to it from that prop, and the only thing that can replace it is
`loadDiskVersion` behind a confirmation.

### 2.9 D9 — no control is called "keep my draft", and a test checks the rendered labels

The prohibition of split §6. `ConflictChoice` is 2c-1a's four names, the component renders them
through `tConflictChoice`, and `rawEditor.test.ts` asserts the absence of the phrase in **both**
languages against the rendered labels rather than against the code names. There are no placeholder
controls for 2c-4 anywhere.

### 2.10 D10 — the editor outranks the pane's other two subjects while it is open

`DetailPane` tests `editing` before it tests the raw viewer or the selection, and hides the
show/hide toggle while the editor is open. An editor holding unsaved text may not be dismissed by a
sidebar click, and the *Stop editing* control asks before discarding anything.

The consequence — the editor can be showing a file the rest of the window is no longer pointed at —
was recorded as an acceptable hole in the first version of this record, and the review was right
that it is not one: the conflict state's *Reload disk version* read the **viewer's** text, so a
click elsewhere left it permanently disabled and one of the eight requirements of split §6 was lost
to navigation. `BrowserState.rawTextOf(document)` answers by file, so the affordance follows the
editor rather than the pane (§8.6, and §12.5).

### 2.11 D11 — a save that failed is not always a file that is untouched

Two arms, not one. `may_have_written` is `true` for a failure at or after the rename, and the file
may already hold the candidate; the editor draws its own sentence for that case and never
*nothing was written*. This is `PROGRESS.md` D2 read from the other side — the invariant is that a
committed write is never reported as an error, and reporting a *possible* write as a certain
non-write is the same lie with the sign flipped.

### 2.12 D12 — the editor cannot be left while a save is in flight

The request is already authorized and cannot be cancelled. Unmounting the editor would leave it
free to commit with its outcome drawn nowhere — under a dialog that had just said the changes were
not written. So the close control is disabled *and* `requestClose` refuses, a sentence says the
save cannot be stopped, and a discard confirmation raised before a save starts is withdrawn when
one does.

### 2.13 D13 — a file with carriage returns is refused, not reformatted

**The project's central promise, defended at the one screen that can write.** A `<textarea>`'s *API
value* — `event.currentTarget.value`, the only way this editor learns what was typed — is defined by
the HTML specification as the raw value with every line break normalized to LF. So a CRLF document
lost its carriage returns on the first keystroke, the save wrote the normalized text, and the saved
panel's *what is on disk now is exactly the text that was sent* stayed true while every line ending
in the file had been rewritten. The window reading measured it: three CRLF endings in, none out
(§9.10.1).

`rawEditorRefusal(text)` answers a refusal for a `\r` **anywhere** — a lone carriage return
normalizes the same way, and one inside a block scalar is a byte of the user's content this editor
equally cannot give back.

**The alternative, named rather than left to be rediscovered: *reconstruct-on-save*** — diff the
candidate against the base and put the carriage returns back on save. It is unsafe, and the committed
corpus says why: `file-comments-and-mixed-endings.yml` has exactly **two** CRLF lines among bare-LF
ones, so re-applying a dominant convention would rewrite line endings on lines the person never
touched. That is the same violation wearing a different hat and harder to see. A refusal preserves
the promise exactly and forecloses nothing — a CRLF-capable editor, one that does not read its value
back through a text area, can be built later on top of it. The idiom is the project's own: the hazard
gate, the `NotUtf8` refusal, *this app will not edit this snippet*.

#### How the invariant is held, in three categories that must not be conflated

The first version of this section said *what TypeScript forces here is that no session exists for
such a text*, and the second review pass was right that this was **false**: `editText` took a bare
`string` and `RawEditorSession` is a structurally constructible interface, so
`editText(session, 'a\rb')` type-checked from a valid session and produced a candidate this editor
could never read back. The claim was a category error — it described what the component path happened
to do as though it were what the type system enforced. That is the class of defect this project
treats as sharpest, so the three categories are now separated by name.

**1. What TypeScript enforces.** The drafted value is `RoundTripText`, a branded `string` whose only
constructor is `roundTripText`, which applies the check. `RawEditorSession.draft` is
`Draft<RoundTripText>`, so **a plain `string` does not type-check into a draft, a submission, a
history step or a candidate anywhere on this path** — the three doors (`startRawEditor`, `editText`,
`loadDiskVersion`) each mint one or refuse. This is the same construct as `DraftConsent`,
`ReloadConfirmation` and `SealedWholeDocumentSave`, and it has the same floor: a brand is a cast at
bottom, so code that writes `as` can defeat it, and no TypeScript brand in any of the four cases
claims otherwise.

**2. What the run-time guards enforce.** `startRawEditor` answers `null`, `editText` and
`loadDiskVersion` answer the session unchanged, and **`beginSave` re-checks the draft's own value**
and answers `null` — deliberately redundant, because it is the last line before a wire that replaces
a user's file and the check is cheap here and unrecoverable one step later. These are what hold if
the brand is ever cast around.

**3. What merely happens to be true of the current component path, and is written as no guarantee at
all.** A `<textarea>`'s API value never carries a carriage return, so the running screen never
attempts one of these edits. **That is a property of the platform and of one component, not of this
module**, and it is exactly the sentence that made the first version of this record wrong. It is
recorded here so that a future editing surface — a contenteditable, a paste handler, a different
input element — is not assumed to inherit it.

Above all three, the screen: `DetailPane` withdraws *Edit this file's text* and says why, and
`RawEditor` draws the reason instead of a box if it is mounted anyway. **What nothing forces is that
a caller asks before drawing a control**; `DetailPane` is the one caller, and that is a fact about
today's callers rather than about the type.

### 2.14 D14 — the clipboard falls back to a selection, and still discloses a failure

`navigator.clipboard.writeText` was refused in every window reading (§9.10.2), and the conflict's
destructive step tells the person to copy their text *first*. A control that cannot copy, offered at
the one place a draft is deliberately discarded, is the wrong control in the wrong place.

**This decision rests on a measurement the re-take found unsafe, and it survives anyway.** §9.11.4
established that both runs were taken with the machine's screen locked, so the refusal may have been
the platform's answer to an unfocused document rather than this webview's answer to a permission —
and the fallback was refused too, for the same reason. A second route that costs no dependency is
worth having whether or not the first one was misdiagnosed; what changed is the *claim*, not the
code. Hole 8.12 is the open question.

`copyBySelecting` puts the text in an offscreen carrier text area, selects it and calls
`document.execCommand('copy')`. Offscreen rather than `hidden` or `display: none`, because an element
that is not rendered cannot hold a selection — the usual way this fallback is written and does
nothing. **Not `@tauri-apps/plugin-clipboard-manager`**: that is a new dependency plus Rust, and this
phase writes neither.

**Putting the screen back may not swallow the answer.** The first version restored focus in an
unguarded `finally`, and the second review pass was right about what that costs: a throw there
escaped the whole function, the caller's assignment never ran, and the person got **no** disclosure
— neither success nor failure — on the one control that exists to keep a draft from being lost.
Silence is the worst answer this path can give. So `copyBySelecting` always returns a boolean,
removal and focus restoration are separately swallowed through one named `quietly`, and the
**selection** is snapshotted and restored as well as the focused element — a form control's own
offsets when it has them, the document's ranges otherwise. Restoring focus alone put the caret at the
start of whatever the person had highlighted.

**The disclosure stays.** When both routes fail, `browser.rawEditor.draftCopyFailed` still says the
text is in the box above and can be selected by hand, which is true: the box is read-only during a
conflict, so the bytes on screen are exactly the bytes a copy would have made. Replacing an honest
failure with a silent one would be worse than the failure.

---

## 3. The seal, decided on evidence — hole 4.2 of 2c-1a

`2c-1a-notes.md` §4.2 said: *"2c-1b is where the seal is proved or found wanting, and if its
component ends up not taking a sealed value, this construct will have bought nothing and that
should be said rather than the shape kept for its own sake."*

**Decision: seal it, in `BrowserState.saveRawDocument`.** Its sealed arm is what `applySave` in
`rawEditor.ts` opens.

**The seal is not ceremony, and it is also not the invalidation.** Both halves matter, and the
review asked for them to be said precisely rather than in the first version's framing.

*What it gates.* `describeWholeDocumentSave` takes a `WholeDocumentOutcome`, which **only**
`sealWholeDocumentSave` produces, and it is the only describer that attaches *this replaces the
entire document*; and the editor's one-shot rebase happens on the way through the opener. So the
editor cannot present a whole-document replacement as an edit, cannot read the outcome without
running a routine of its own, and cannot apply the same answer twice.

*What it does not do.* It does not perform the workspace's cache invalidation. That has already
happened by the time anyone can open a seal: `createBrowserState`'s `saveRawDocument` passes its
own invalidation to the command, which calls it before its promise resolves, and that is the only
moment early enough (`2b-2c-3b-notes.md` §3).

The remaining choice was **where** the sealing happens:

- **in the editor** — the component calls `sealWholeDocumentSave(document, result, …)` itself. That
  re-asserts the document/result pairing at every caller, which is exactly what D7 of 2c-1a built
  the shape to stop, and it would be re-asserted again by 2c-5's restore-from-backup;
- **in the adapter** — one pairing, in the module that issued the save and therefore knows both.

The second.

**And the seal carries the issuer's own invalidation status**, which is the review's third finding
and the reason `sealWholeDocumentSave` now takes a required third argument. Before it, a committed
save whose re-projection failed reported to the developer channel and stopped there, so the person
saw a clean *the file was written* while the window was drawing a file it had not been able to read
back. The status travels with the outcome, `applySave` appends `windowOutOfStep` **beside** the
saved arm, and `browser.saveOutcome.windowOutOfStep` is reachable in the running application.

The residue is stated rather than glossed: what the seal forces is that a **routine is called**,
never that the routine acts — no TypeScript signature can require a body to do anything
(`2c-1a-notes.md` §4.3, unchanged in kind).

---

## 4. The three arms, drawn

| Arm | What is drawn | Where the decision lives |
|---|---|---|
| `saved` | `fileWritten` or `nothingToWrite`, `backupTaken`, every presentation note, and a dismiss | `describeSaved` in `saveOutcome.ts` |
| `refused` | `nothingWasWritten`, the raw-save model's own lines (`replacesWholeDocument`, `willNotLoad`, `stoppedAt`/`positionUnknown`), the verdict, the other findings, the choices, and the staleness sentence | `describeRefused` and `describeRawSave` |
| `conflict` | the four (or five) conflict sentences, three revisions, the disk version's text, and the two-step choices | `describeConflict`, `CONFLICT_FIRST_STEP`, `CONFLICT_CONFIRM_STEP` |

`committed: false` is drawn as a **success** with its own sentence, and the draft is rebased on it
for 2c-1a's D4 reason. The parser's own `detail` is never rendered — it comes from `saphyr-parser`,
cannot be localized, and a mounted test asserts its absence from the DOM. The byte offset is never
rendered either: it counts bytes and a JavaScript string index counts UTF-16 code units.

---

## 5. Where the base revision comes from — rewritten, because the first version was wrong

`document_text` answers a **string and no revision**, so the editor's base revision and its starting
text come from two different reads and this window asserts that they belong together. The first
version of this record said that assertion was safe in one direction, and **it was not**. The
review's first finding is the counter-example, and it is worth stating in full because it is the
one path in this phase that could have lost a user's file:

> The viewer holds text T0 at revision R0. Another process writes T1/R1. Selecting a snippet
> triggers stale-identity recovery, which installs the R1 projection — but `readFileText` skips the
> re-read because the document identity has not changed. *Edit* then pairs stale T0 with newer R1.
> Saving an edited T0 passes the revision check and silently overwrites T1.

The record's argument had been *the base can only be older, so a mismatch is refused as a conflict*.
That argument is about the order of two **reads**; the defect is a third event — a projection
**installed** under a snapshot — which the argument never considered. Two changes close it, and both
are tested:

1. **The revision is captured with the read, not read off the projection later.**
   `readFileText` records `viewOf(target.id)?.revision` immediately **before** calling
   `document_text`, and `BrowserState.fileTextRevision` answers that captured value. The editor
   opens on a pair that was taken together; the projection moving afterwards cannot retarget it.
2. **`installView` drops a snapshot whose projection it replaces.** A viewer showing R0's bytes
   beside a snippet list drawn from R1 was already wrong; since 2c-1b it is also the thing that
   would have produced the bad pair, so the snapshot goes and every caller's following
   `readFileText` re-reads.

What is still an assertion, said in the same breath as what is now forced: the pair is two reads,
and the capture happens **before** the text read. That bounds the ordinary error to one direction —
the revision is the older of the two, so a file that moved between them is refused as a conflict —
and it does not eliminate it. §8.1 states the case that survives.

---

## 6. The jsdom decision, taken and scoped

`vite.config.ts` has said *"Adding jsdom later is a deliberate decision, not a default"* since 1b-1.
Taken here, and narrow:

- `jsdom` is a pinned devDependency (`30.0.1`, exact, like every other one);
- `test.environment` stays `node`. One file opts in with a `/** @vitest-environment jsdom */`
  docblock. `environmentMatchGlobs` is gone in vitest 4, so the docblock is the supported per-file
  form, and `test.projects` was not needed;
- **the existing six components are not back-filled**;
- `resolve.conditions: ['browser']` is added **only under `mode === 'test'`**, and as a conditional
  spread rather than as `underTest ? ['browser'] : []`. That second form was written first and is a
  real defect: `resolve.conditions` **replaces** Vite's defaults, so the empty array cost the
  production build its `browser` condition — `vite build` began resolving
  `svelte/src/internal/server/render-context.js` and externalising `node:async_hooks`, 154 modules
  becoming 180. Found by reading the build output, fixed, and both directions re-checked.

Without the condition, `mount()` throws `lifecycle_function_unavailable` — which is what the first
run of `RawEditor.test.ts` really did, not a hypothesis.

Svelte's own `mount` / `unmount` / `flushSync` are used rather than a testing library. The claims
this file makes are about real DOM events reaching real handlers, which those three give directly;
a query library would have added a dependency for selectors this file does not need.

**A mounted test does not replace the window reading, and this record does not let it.** It proves a
handler fires and that the right value reaches the boundary. It cannot prove a window draws: jsdom
has no layout, no WebKit and no opinion about whether a pane is visible.

---

## 7. Tests

**`src/lib/browser/rawEditor.test.ts` (38)** — **a text this editor cannot give back unchanged**
(a CRLF document refused and `startRawEditor` answering `null`; a *lone* carriage return and one
inside a line refused too, because both normalize the same way; a text with none of them opening,
including an empty one and one whose source writes a literal `\r` escape, which is the oracle; **no
path in the module turning a document with carriage returns into an LF candidate**, checked at the
constructor and at `loadDiskVersion`, with the LF twin of the same call reloading so the guard is a
refusal and not a broken transition; and the sentence present in both languages through the key
builder; **an edit that would put a carriage return into a clean session refused**, with the same
edit without one taken; and **no exported path producing a candidate that carries one** — checked at
the constructor, at `editText`, at `loadDiskVersion` and at `beginSave` with a value planted past the
brand, which is the only way that last guard can be driven); the draft (clean at the start; dirty derived, so
typing back is clean and no `dirty` key exists; undo and redo, and an edit that changes nothing
being no step; **read-only while saving**; **read-only during a conflict**, with the draft intact
and the box given back by *Keep editing*); starting a save (gated on dirty, the candidate and base
sent, nothing acknowledged first, refused during a conflict, a send that never left, and **a send
that may have written kept apart from one that certainly did not**); taking the answer (the seal
opened; a second open leaving the session alone; the rebase onto the candidate; the same rebase for
`committed: false`; a committed save whose invalidation threw still being a committed save; **the
issuer's failed re-projection drawn as `windowOutOfStep` beside the saved arm**; and that line
appearing once rather than twice); the acknowledgement round trip (the offer made exactly when it
would work; **every** finding re-sent, in order; the consent and the control both withdrawn by an
edit and by an undo; nothing recorded when there is no refusal; and the raw-save model's own lines
before and after); and the conflict (nothing written and the draft copyable byte for byte; the
changed-again sentence; enough revision information; **no retry of the stale candidate**; the copy
offered before the destructive choice at **both** steps; no reload without a confirmation and none
automatically; the reload starting a clean draft; a confirmation from another conflict refused; and
**no label reading "keep my draft" in either language**).

**`src/lib/components/RawEditor.test.ts` (20)** — mounted, in `jsdom`. The file, its text and the
standing statement are drawn; the save control is gated on dirty **and un-gated by typing back**;
undo works through the control; a save sends the draft and reports the file written; a command
failure says the save could not be sent and invents no outcome; **a failure that may have written
never says nothing was written**; **a committed save whose re-projection failed says the window is
out of step beside it, never instead of it**; **the editor cannot be closed while a save is in
flight**, and a discard confirmation raised before a save is withdrawn when one starts; **the
acknowledgement round trip** — a refusal draws the parser's position (substituted, not a
placeholder) and *not* the parser's own diagnostic, and *Save anyway* sends exactly the findings the
refusal carried; **editing after a refusal withdraws the offer and the consent**, and the next save
is a first attempt; a conflict is terminal, keeps the draft, freezes the box, offers no retry, and
needs two clicks to discard; a copy that fails says so; a disk version that cannot be read disables
the destructive control; and leaving asks when there is unsaved text and does not when there is not.
**A CRLF document draws no box at all** — no text area, no save control, the refusal's sentence, and
a way out that asks about no draft — while the same document with its carriage returns removed opens
normally; **a disk version with carriage returns cannot be loaded** over the draft and says why; and
**the clipboard falls back to a selection copy** when the asynchronous API is refused, handing over
the draft byte for byte and leaving no carrier behind — **and still discloses the copy when putting
the screen back throws**, which is the case that would otherwise draw nothing at all.

**`src/lib/browser/workspace.test.ts` (+8, and nine rewritten)** — the sealed answer carries nothing
(`Reflect.ownKeys` empty, `JSON.stringify` `{}`), opens once, and brings the state's own
invalidation status with it; **a held snapshot is never paired with a revision installed under it**,
and the revision is the one captured when the read started; a failure after the rename answers
`mayHaveWritten: true` and one before it `false`; a committed save whose re-read failed answers
`issuerInvalidation: failed` and one that succeeded answers `done`; and **the disk text of a
conflicted save is kept by document**, so an editor open on one file keeps it while the pane shows
another. The nine existing cases now open the seal through one helper, which is itself the point
being made.

**`src/lib/browser/invalidation.test.ts` (+2)** — the issuer's status is handed back arm for arm,
and kept apart from what the opener's own callback did.

**Oracle check, run three times and not assumed.** Deleting the staleness filter from
`rawEditorView` fails two tests, one model and one mounted. Reverting all five review fixes — the
`installView` invalidation, the captured revision, the carried re-projection status, the
indeterminate failure arm and the close guard — fails eight, spread across all three files. Reverting
the two reading fixes — the carriage-return refusal and the clipboard fallback — fails six, three in
each file. Reverting the two second-pass fixes — the `editText`/`beginSave` guards and the guarded
cleanup — fails three, two model and one mounted. A suite that passes on its first run over new
behaviour is a suite that has not been shown to disagree.

---

## 8. Holes this phase leaves open

### 8.1 The base revision and the text are still two reads, paired by this window

§5 states what is now forced: the revision is captured immediately before the text read, and a
projection installed under a snapshot takes the snapshot with it. What is **not** closed is that the
two are still two reads of the same file at two moments, and no type says they belong together.

The case that survives: if a file were changed and then changed *back* to its earlier revision
between the capture and the save, the base would agree with the lock and text drafted from the
intermediate bytes would be committed over it. Two external writes, the second restoring exactly the
earlier bytes.

**The first version of this record claimed a bound that the code did not have**, and the review's
first finding is why — see §12.1. The claim now made is narrower and matches what the tests check.

The correct fix is a wire change — `document_text` answering the revision it read — which is Rust
and is not this phase's. A cheaper narrowing exists and was **not** taken: `DocumentView.byte_len`
counts the projected bytes, and `new TextEncoder().encode(text).length` counts the shown ones, so a
mismatch would prove the two reads disagree. It catches only length-changing edits, it needs a
refusal message of its own, and it would be a heuristic standing where a revision belongs. It is
written down here so that a later phase chooses rather than rediscovers.

### 8.2 The document, the revision and the text are asserted by the component's caller

`RawEditor` takes `file`, `baseRevision` and `text` as three props, and nothing in its type requires
them to describe the same file at the same moment. `DetailPane.startEditing` is the one caller and
takes all three from one place; a second caller would be a second assertion. This is the same class
of residue as 2c-1a's §4.2 — a gate is unignorable on the path through it, not on every path.

### 8.3 The disk version's text and the disk revision are also two reads

`loadDiskVersion` is given `conflict.diskRevision` and the text the workspace re-read. They are
taken from the same conflict handling, one immediately after the other, but nothing types them
together. The consequence is bounded: the reload starts a **clean** draft at that revision, so a
disagreement produces a spurious conflict on the next save rather than a bad write.

### 8.4 A hundred keystrokes fills the history

D4's consequence. The bound is still 2c-1a's `HISTORY_LIMIT = 100` and it is still a guess, now with
a known unit: one keystroke. `2c-1a-notes.md` §4.5 asked for a real number once an editor existed;
this phase produces the unit and not the number, because no session has been profiled.

### 8.5 The clipboard may refuse, and the failure is disclosed rather than worked around

`navigator.clipboard` is absent outside a secure context and undefined under jsdom. The copy's
failure is caught and `browser.rawEditor.draftCopyFailed` says the text is still in the box, which
it is — the box is read-only during a conflict, so the bytes on screen are exactly the bytes the
copy would have made.

**Attempted twice, and still not measured.** §9.10.2 read `navigator.clipboard.writeText` being
refused and §9.11.4 read the `execCommand` fallback being refused too — but both runs were taken with
the machine's **screen locked**, so no document could hold focus and both routes are refused by the
platform for a reason that is not about this webview. The disclosure is correct and its fallback
(a manual selection from the read-only box) is real either way. What is unknown is whether either
route works for a person with the window in front; that is hole 8.12.

### 8.6 The editor can outlive the pane's pointer at its file, and that is now only cosmetic

D10's cost. A sidebar click while the editor is open leaves the editor showing, correctly targeted
at the file being edited, while the rest of the window describes another. The alternative — closing
the editor on a sidebar click — discards a draft silently, which is worse.

**What used to follow from it was a real loss and no longer does.** The conflict state's disk
version came from `browser.fileText`, which is about the *viewer's* target, so the *Reload disk
version* control went permanently disabled the moment the person navigated away — one of the eight
requirements of split §6 lost to a click (§12.5). The conflict's disk text is now kept by document
and read through `BrowserState.rawTextOf(id)`, so the affordance follows the editor. What remains is
cosmetic: the pane shows one file's editor above a window describing another.

### 8.7 `read_only` is honoured by the pane, not by the editor

`DetailPane` does not offer *Edit this file's text* for a read-only file and says why. `RawEditor`
itself would happily draft one, and the refusal that really protects the file is Rust's. Nothing in
this phase can be reached that way; a second caller could.

### 8.8 Twenty-five more Spanish sentences checked only by heuristic

The parity tests check that no Spanish value is byte-identical to its English counterpart and that
the placeholder sets agree. Nothing establishes that any of the twenty-five is idiomatic, and three
of them carry a `{revision}` operand whose sentence shape differs between the languages.

### 8.9 The markup scanner still cannot see a string in a `<script>` block

Unchanged in kind (`scripts/lint/hardcoded-strings.ts`, hole 1). `RawEditor.svelte` has more
script than any component before it — eight handlers — and every user-facing string in it goes
through `t`/`t*`, which is checked by review and by the mounted test's dictionary matching, not by
the scanner.

### 8.10 What the window reading could not reach

§9 is taken, so this is no longer *nothing has been seen*. What it did not see is three arms and one
class of fact: the **indeterminate** send failure (§9.9), `windowOutOfStep` (§9.10.5),
`nothingToWrite` (§9.10.3 — unreachable by design), and **pixels** (§9.12). The mounted test is the
only evidence for the first two.

### 8.11 A CRLF document cannot be edited at all — *decided, see D13, and read at §9.11.1*

The window reading found this as a **defect**, not a hole (§9.10.1): a `<textarea>`'s API value has
its newlines normalized to LF, so the first keystroke in a CRLF file replaced the model's whole value
with an LF-only one and the save wrote that. It is fixed by a refusal, and the reasoning is D13.

**The refusal has been read in a window** (§9.11.1, §9.11.2, §9.11.3): over the committed corpus
fixture, in both languages, the *Edit this file's text* control is absent, the reason is drawn, no
box is mounted, the file's bytes are untouched afterwards, and the LF twin of the same content still
opens — so the refusal is about carriage returns and not about that file.

What remains as a hole is only the consequence: **this editor cannot open a file with carriage
returns**, and until a later phase builds an editing surface that does not read its value back
through a text area, such a file can be browsed and not repaired here. The same is true of a
conflict whose *disk version* has them: the version is shown but cannot be loaded, and the control
that would load it is disabled with the reason beside it (§9.11.3).

### 8.12 Whether the clipboard works at all is still unknown — *fallback decided, see D14*

**Two window readings and the question is still open**, which is worth stating plainly rather than
letting two negatives read as a settled answer. §9.10.2 read `navigator.clipboard.writeText` refused;
§9.11.4 read the `document.execCommand('copy')` fallback refused as well, and `pbpaste` confirmed
nothing reached the system clipboard. **Both runs were taken with the machine's screen locked**
(`CGSSessionScreenIsLocked = true`, frontmost application `loginwindow`, `document.hasFocus()` false
throughout), and both routes are gated on a focused document, so neither result is evidence about
this webview. Two attempts to bring the window forward failed — `open -a` did not change
`hasFocus`, and the `System Events` route timed out with `-1712`, the accessibility wall of
`1c-1-notes.md` §10.2.

What **is** known: the failure is disclosed, the read-only box still holds the bytes for a manual
selection, the offscreen carrier is removed and focus is restored rather than left in a detached
element (§9.11.4). What is not: whether a person with the window in front gets a copy. **Settling it
needs a human at an unlocked machine**, and no rearrangement of this project's window-reading
technique substitutes for that.

### 8.13 `committed: false` is unreachable from this screen

§9.10.3, argued from `canSave` and then read in a window. `browser.saveOutcome.nothingToWrite` and
the whole `committed: false` presentation are drawn by a branch this screen cannot enter; the only
routes to it are the two-reads races of §8.1 and §8.3. The arm is still worth having — 2c-5's
restore-from-backup and 2c-2's snippet editor can both reach it — but this phase should not be read
as having exercised it.

### 8.14 A save drops the undo history

§9.10.4. After a committed save, *Undo* is disabled: the draft is rebased on what was written and
what the file held before is no longer reachable from the editor. The backup is the recovery route
and it is disclosed in the same panel, so nothing is lost silently; what is missing is any sentence
saying the history went.

---

## 9. The window reading, taken

The third kind of evidence the split's §7 requires, and the review's sixth finding. **Taken against
the fixed code**, which is the whole reason it was left until after the fix round: those fixes edited
`RawEditor.svelte` and `DetailPane.svelte`, and nothing in this repository except one file renders a
Svelte component in an automated test, so a reading taken before them would have been a record of a
program that no longer exists.

**Fifteen launches, one plan each, and every plan ran to its own `--- end`.** None stalled at the
six-second boundary, so nothing below is a partial transcript rounded up. Ten plan names, taken in
one or both languages and with one of three external provocations where a plan needed one.

**This section holds two runs, and says which is which.** The first run is §9.2 to §9.10 and stands
as taken. It found two defects (§9.10.1, §9.10.2); both were fixed — D13 and D14 — and a second
review pass found two more in those fixes, which were fixed as well. That changed
`RawEditor.svelte`, `DetailPane.svelte` and `rawEditor.ts`, so this project's own rule fired and the
parts of the reading those changes touch were **re-taken**: §9.11, five more launches. The plans the
changes do not touch were not repeated, and nothing in §9.2 to §9.9 has been edited to look like it
was — a reading is a record of a screen at a moment, and rewriting one to match later code would be
inventing evidence.

### 9.1 The setup

The technique is `1c-1-notes.md` §10 with the constraint of `1c-2b-2b-2-notes.md` §6.1 unchanged:
`npm run build`, then `cargo build -p espansoconfig --features custom-protocol`, before every launch;
the binary placed in a hand-assembled `espansoConfig.app` (`Contents/MacOS` + `Info.plist`); ad-hoc
code-signed; launched through LaunchServices with

```sh
open --env "ECFG_PROBE_PLAN=<plan>" --env "XDG_CONFIG_HOME=<scratch>/xdg" \
     --env "HOME=<scratch>/home" --stdout <log> <scratch>/bundles/<plan>-<stamp>/espansoConfig.app
```

**One plan per launch, into a fresh bundle path each time.** A temporary `probe_plan` command reads
`ECFG_PROBE_PLAN`; a temporary `render_probe` prints the transcript to stdout; a `setTimeout` in
`src/main.ts` drives one plan 700 ms after mount. The plan name carries the language after a colon
(`refuse:es`), and the language is set through **the application's own picker** with a bubbling
`change` event — Svelte 5 delegates that event and a non-bubbling one silently does nothing.

The probe reaches the screen the way a person does: `HTMLElement.click()` on a real control, and for
the text area a `value` assignment followed by a bubbling `input` event, which is the path
`RawEditor.svelte`'s `oninput` takes. What it does not exercise is pointer hit-testing, which is a
pixel question — §9.12.

**The configuration was synthetic and hand-written for this run**, in a scratch directory outside the
repository: `config/default.yml`, `match/base.yml` (two neutral matches, LF endings, 261 bytes) and
`match/crlf.yml` (one neutral match, **every** line ending CRLF, 66 bytes). `XDG_CONFIG_HOME` and
`HOME` both point into that tree, and **both the configuration and `HOME` are rebuilt from scratch
before every launch** — the configuration because this phase's screen writes files and a reading must
not stand on the previous reading's bytes, `HOME` because the locale override lives in the webview's
`localStorage`, which is keyed by it. **The owner's real configuration was never opened**, which for
a raw editor that can write is not a formality. Nothing below quotes anything but this run's own
synthetic content and this application's own strings.

### 9.2 Reading 1 — the editor opens and draws (plan `open`, both languages)

```
panes: nav.sidebar: x=0 y=44 w=268 h=645 | section.list: x=268 y=44 w=375 h=645
       section.detail: x=644 y=44 w=536 h=645
viewer toggle: Hide this file’s text          edit control: Edit this file’s text
open shape:   section.rawEditor: x=658 y=58 w=508 h=304
              section.rawEditor textarea.text: x=658 y=133 w=508 h=196
open head:    File match/base.yml Stop editing
open standing: Saving writes this file's whole text exactly as it appears here. This is not an
               edit to one snippet: the entire document is replaced.
open box:     chars=261 cr=0 readonly=false first40="# A synthetic match file, hand-written f"
open toolbar: [Undo DISABLED] [Redo DISABLED] [Save this file DISABLED]
open outcome: ABSENT   sendFailure: ABSENT
allButtons:   [All 3] [match/base.yml 2] [match/crlf.yml 1] [config/default.yml –] [:hello]
              [:today ⌗Variables] [Stop editing] [Undo DISABLED] [Redo DISABLED]
              [Save this file DISABLED]
```

The Spanish launch is identical to the byte in geometry: `Archivo match/base.yml Dejar de editar`,
the same standing sentence in Spanish, `[Deshacer DISABLED] [Rehacer DISABLED] [Guardar este archivo
DISABLED]`.

Four things in that transcript are claims the code makes and this is where they were checked. The
editor is a **real box of a real size** holding the file's whole 261 characters, not an empty one.
The **whole-document warning is the standing statement**, drawn above the box before any save.
**`browser.detail.fileTextShow`/`Hide` is gone from `allButtons`** while the editor is open, which is
D10's half of "the editor outranks the pane's other two subjects". And the file's own text stayed
English while the interface changed language around it.

### 9.3 Reading 2 — dirty gates the save control (plan `dirty`)

```
pristine toolbar: [Undo DISABLED] [Redo DISABLED] [Save this file DISABLED]
pristine head:    File match/base.yml Stop editing
typed toolbar:    [Undo] [Redo DISABLED] [Save this file]
typed head:       File match/base.yml Unsaved changes Stop editing
undone toolbar:   [Undo DISABLED] [Redo] [Save this file DISABLED]
undone head:      File match/base.yml Stop editing            undone box chars: 261
redone toolbar:   [Undo] [Redo DISABLED] [Save this file]     redone box chars: 277
```

Undo back to the base disables the save control **and** withdraws the *Unsaved changes* marker, which
is `isDirty` being derived rather than a flag: the two agree because there is only one of them.

### 9.4 Reading 3 — the saved arm, and a backup that really exists (plan `saved`)

One appended line, then *Save this file*:

> The file was written. What is on disk now is exactly the text that was sent. / A copy of this file
> as it was before this session's first change to it was kept. Only the last ten sessions of copies
> are kept, so this is not a promise that the file can be recovered later. / **Dismiss**

`saved toolbar: [Undo DISABLED] [Redo DISABLED] [Save this file DISABLED]` — the draft was rebased
onto the candidate, so it is clean again.

**Both halves checked on disk, not inferred from the panel.** `cmp` of the file against the pristine
file plus the appended line: **identical**. And the backup the second sentence discloses is really
there — `<scratch>/xdg/espanso/.espansoconfig-backups/<timestamp>/match/base.yml`, beside its
`.espansoconfig-batch` marker, `cmp`-identical to the file **as it was before the save**.

**`committed: false` was not read, and §9.10.3 is why**: it is unreachable from this screen by
design, and the attempt to provoke it is itself a reading.

### 9.5 Reading 4 — the refusal, the acknowledgement, and the bytes on disk (plans `refuse`, `stale`)

The box was replaced with three lines that do not parse. On *Save this file*:

```
refused head:     File match/base.yml Unsaved changes Stop editing
refused standing: Saving writes this file's whole text … the entire document is replaced.
               // espanso will not load this file until this is fixed.
               // The YAML reader stopped at line 3, column 3.
refused outcome:  Nothing was written. The file on disk is exactly as it was.
                  The result contains something that looks wrong. Saving it needs your
                  confirmation first.
refused choices:  [Save anyway] [Keep editing]
refused box:      chars=53 readonly=false
```

and in Spanish, `El lector de YAML se detuvo en la línea 3, columna 3.` / `No se ha escrito nada. El
archivo del disco sigue exactamente igual.` / `El resultado contiene algo que parece incorrecto.
Guardarlo requiere tu confirmación previa.` / `[Guardar de todos modos] [Seguir editando]`.

The parser's stop position is **substituted into the sentence**, and neither the parser's own
`detail` nor the byte offset appears anywhere in the pane — the two things §4 says are never drawn.

**Then *Save anyway*, and this is the one claim the whole phase rests on.** The panel became the
saved arm, and:

```
cmp <the exact 53-byte candidate> <scratch>/xdg/espanso/match/base.yml   →  identical
```

in **both** languages, run twice on two separate launches. A raw save really does write text the YAML
reader rejects, byte for byte, exactly as the owner's ruling requires. The sidebar tells the truth
about the consequence in the same breath: `[All 1] [match/base.yml 0]`, because the file it just
wrote no longer projects any snippets.

**Consent is withdrawn by an edit** (plan `stale`): after the same refusal, one more typed line and

```
edited-after-refusal choices: [Keep editing]
edited-after-refusal outcome: … The result contains something that looks wrong. Saving it needs
   your confirmation first. These findings are about the text as it was when it was sent, and you
   have changed it since. Save again to have the text as it is now checked. Keep editing
```

*Save anyway* is gone and `browser.rawEditor.findingsAreStale` has taken its place — the control does
not vanish silently. `cmp` afterwards: the file is still the pristine one, **nothing was written**.

### 9.6 Reading 5 — the conflict, and the eight requirements one by one (plan `conflict`)

The editor was opened, a line typed, and then the file was rewritten **from the shell** while the
editor held it. The probe waited for the change to be real — polling `reload_document` until the
revision moved — rather than sleeping and hoping, and only then sent the save. **That polling is
worth disclosing rather than hiding**: it refreshes the command layer's own parse, so the mismatch
this reading provoked was caught by the session check rather than only by the check under the write
lock. Both answer the same `conflict` outcome, and the second of them is the one no reading can steer
to; the transcript below is therefore evidence about the screen, not about which of the two checks
fired.

```
base revision before the external write: 8a96f9d5…2ee4
disk revision after  the external write: 21fbf489…e6c0
conflict head:    File match/base.yml Unsaved changes Stop editing
conflict box:     chars=281 readonly=true
conflict toolbar: [Undo] [Redo DISABLED] [Save this file DISABLED]
conflict choices: [Keep editing] [Copy my text] [Load the version on disk]
after the second step: [Keep editing] [Copy my text] [Discard my text and load it]
```

and the panel, `innerText`:

> Nothing was written. The file on disk is exactly as it was. / This file changed after its text was
> loaded here, so the save was refused rather than applied over that change. / Your text is still
> here, exactly as you wrote it. Nothing has been discarded and nothing has been reloaded. / Loading
> the version on disk replaces your text with it, and your text cannot be brought back afterwards.
> Copy it first if you want to keep it. / Your text was loaded from version 8a96f9d5…2ee4. / The file
> held version 21fbf489…e6c0 when the save was refused. / The version read from disk afterwards is
> 21fbf489…e6c0. / **The version on disk** *(and then the disk version's own text, through
> `SourceText`)* / Keep editing Copy my text Load the version on disk

Split §6's list, against that screen:

| Requirement | What was read |
|---|---|
| states unambiguously that nothing was written | the first sentence, and `cmp` — the file still holds **the external writer's** bytes exactly |
| preserves the draft byte-for-byte | `chars=281` = the 261 loaded plus the 20 typed |
| never reloads automatically, never clears dirty | *Unsaved changes* still in the head; the box still holds the draft |
| never retries with the stale candidate | `[Save this file DISABLED]` |
| offers *Keep editing* and an explicit *Reload disk version* | both, by those names |
| warns, requires confirmation, offers *Copy draft* first | the fourth sentence; two steps; *Copy my text* present at **both** steps |
| enough information to tell the two versions apart | three revisions in full, the file's path, and the disk version's own text drawn |
| a committed save stays committed even if the reload fails | **not read** — §9.10.5 |

**The box is `readonly=true` throughout**, which is D3, and it is what makes *Copy my text* copy the
bytes that are on screen rather than bytes that moved under the warning.

The Spanish launch reads the same, sentence for sentence: `No se ha escrito nada. El archivo del
disco sigue exactamente igual.` / `Este archivo ha cambiado después de que su texto se cargara
aquí…` / `Tu texto sigue aquí, exactamente como lo escribiste…` / `Cargar la versión del disco
sustituye tu texto por ella…` / `[Seguir editando] [Copiar mi texto] [Cargar la versión del disco]`
→ `[… Descartar mi texto y cargarla]`.

### 9.7 Reading 6 — both languages, and the prohibited phrase

Every label this screen drew in either language, across all fifteen launches:

```
EN  Edit this file’s text · Stop editing · Undo · Redo · Save this file · Dismiss ·
    Save anyway · Keep editing · Copy my text · Load the version on disk ·
    Discard my text and load it · Discard my changes
ES  Editar el texto de este archivo · Dejar de editar · Deshacer · Rehacer ·
    Guardar este archivo · Descartar · Guardar de todos modos · Seguir editando ·
    Copiar mi texto · Cargar la versión del disco · Descartar mi texto y cargarla ·
    Descartar mis cambios
```

**No label in either language is "keep my draft" or any Spanish equivalent** — no *conservar mi
borrador*, no *mantener mi borrador*, and nothing that would let 2c-4b look already done. That
matches what `rawEditor.test.ts` asserts against the rendered labels, now checked against a window
rather than against a dictionary.

The leaving confirmation was read too (plan `leave`, both languages), because it is the other way a
draft can be lost:

> Your changes have not been written to the file. Leaving the editor discards them, and they cannot
> be brought back afterwards. / **Discard my changes** **Keep editing**

> Tus cambios no se han escrito en el archivo. Si sales del editor se descartan, y después ya no se
> podrán recuperar. / **Descartar mis cambios** **Seguir editando**

*Keep editing* dismissed the dialog with the draft intact (`chars=278` before and after); *Discard my
changes* unmounted the editor and gave the raw viewer back, with its *Edit this file's text* control
on it again.

### 9.8 The in-flight guard, read (plan `inflight`)

The review's fourth finding, on screen. Reported in the same task tick as the click on *Save this
file*, before the answer came back:

```
in flight close:    [Stop editing DISABLED]
in flight toolbar:  [Undo] [Redo DISABLED] [Save this file DISABLED]
in flight standing: This save cannot be stopped, so the editor stays open until it answers.
                 // Saving writes this file's whole text … the entire document is replaced.
in flight box readonly: true
after clicking close in flight: editor still here      leaving dialog: (empty)
after-flight outcome: The file was written. …
```

The control is disabled, the click on it does nothing, no dialog claiming the changes were not
written is raised — and the committed outcome lands in an editor that is still there to draw it.

### 9.9 Reading 7 — the indeterminate arm was **not** provoked

`browser.rawEditor.mayHaveWritten` is drawn when the command fails with `may_have_written: true`, and
that is `WriteError::VerificationFailed` or an `io` failure at `SyncDirectory` or `ReadBack` — the
three points at or after the rename (`crates/espansoconfig-core/src/persist/write.rs`,
`WriteStep::after_rename`). Every one of them is a failure in the microseconds **between** the rename
and the read-back. **It could not be provoked honestly from a window**: the only ways to reach it are
to win that race from the shell, or to instrument the write path — and instrumenting it would mean
the reading was of a different program. **This is a hole, not a reading.**

What *was* read is its determinate sibling, which is what makes the two-armed branch more than an
assertion. Plan `sendfail` deleted the file from the shell after the editor had loaded it, then saved:

```
sendfail sendFailure: The save could not be sent, so nothing was written. Your text is still here.
sendfail box:         chars=295 readonly=false
sendfail toolbar:     [Undo] [Redo DISABLED] [Save this file]
sendfail outcome:     ABSENT
```

No outcome panel is invented, the draft is intact, the box stays editable and the save control stays
live so the person can try again — D7 exactly. The mounted test covers the other arm
(`RawEditor.test.ts`, *a failure that may have written never says nothing was written*), and that is
now the **only** evidence for it.

### 9.10 What the reading found that no test had

**Five things**, and the first two are the reason a reading is not a formality.

#### 9.10.1 A `<textarea>` normalizes CRLF, so a raw save of a CRLF file silently rewrites every line ending

> **This subsection records a program that no longer exists.** The behaviour below was fixed
> immediately after this reading was written: a text with a carriage return anywhere is now refused
> rather than opened, which is D13. The transcript is kept unedited because it is the evidence that
> the defect was real and the measure of what a reading is for — five automated suites and a code
> review had all missed it. **The refusal has since been read in a window: §9.11.1 and §9.11.2**,
> over the committed corpus fixture and its LF twin, in both languages, with the fixture's bytes
> checked afterwards.

`match/crlf.yml` is 66 bytes with three CRLF endings. Opened in the editor:

```
crlf-open box: chars=63 cr=0
```

**Sixty-three characters and no carriage return at all** — the box's API value has already dropped
them, because the HTML `value` getter normalizes newlines to LF and `oninput` reads
`event.currentTarget.value`. The model still holds the CRLF text until the first keystroke, so the
draft opens clean; the *first* edit replaces the whole value with the LF-normalized one. One appended
line, then *Save this file*, and the file on disk afterwards:

```
00000000: 6d61 7463 6865 733a 0a20 202d 2074 7269  matches:.  - tri
00000010: 6767 6572 3a20 223a 6372 6c66 220a 2020  gger: ":crlf".  
00000020: 2020 7265 706c 6163 653a 2022 5477 6f20    replace: "Two 
00000030: 6c69 6e65 2065 6e64 696e 6773 2e22 0a23  line endings.".#
00000040: 2061 7070 656e 6465 640a                  appended.
```

Every `0d` is gone. The panel above it said *the file was written; what is on disk now is exactly the
text that was sent*, and that sentence is **true** — the text that was *sent* is not the text that was
*loaded plus the edit*, and nothing on the screen says so.

This is a defect of this screen, found here and nowhere else. The model tests hand strings straight to
`editText`, so the box is not in the path at all; the mounted test does put a value through a real
`<textarea>`, but neither `rawEditor.test.ts` nor `RawEditor.test.ts` contains a single `\r`, so
**no test in this project sees it today.** The kind that could is a mounted case whose fixture text
carries CRLF, and it was not written because nobody had thought to ask the question. It is left as a finding rather than fixed in the same step that reads it — fixing it is
a change to `RawEditor.svelte` and would invalidate this reading — and it is recorded as hole 8.11.
The project keeps a committed corpus fixture (`crlf-line-endings.yml`) precisely because CRLF
preservation is a promise, which is the measure of how much this matters.

#### 9.10.2 The clipboard would not copy — *this subsection's conclusion is withdrawn, see §9.11.4*

> **The re-take found this subsection's own conclusion unsafe, and §9.11.4 replaces it.** *Copy my
> text* now falls back to a selection plus `document.execCommand('copy')`, which is D14 — and the
> re-take could not settle whether that works either, because **the machine's screen was locked
> throughout both runs**, so no document could hold focus and both clipboard routes are refused by
> the platform for a reason that says nothing about this webview. What the sentence below asserts —
> *"`navigator.clipboard.writeText` fails in this application's webview"* — is therefore **narrower
> than it reads**: it fails under the conditions these readings were taken in. §9.11.4 is what is
> actually known.

§8.5 said *"whether a Tauri WKWebView grants clipboard access at all has **not** been measured, and
the window reading is where that first becomes visible."* It is measured now, in both languages:

> Your text could not be copied to the clipboard. It is still in the box above, so it can be selected
> and copied by hand.

> Tu texto no se ha podido copiar al portapapeles. Sigue en el cuadro de arriba, así que puedes
> seleccionarlo y copiarlo a mano.

**`navigator.clipboard.writeText` fails in this application's webview**, so *Copy my text* never
works. The disclosure is correct and the fallback it names is real — the box is read-only during a
conflict, so the bytes on screen are exactly the bytes the copy would have made. But the conflict's
destructive step tells the person to *copy it first*, and the control offered for that purpose does
not function. That is now hole 8.12 rather than an open question.

#### 9.10.3 `committed: false` cannot be reached from this screen, and the attempt is the evidence

`canSave` is gated on dirty, and dirty is `value !== baseValue` where `baseValue` **is** what was read
from the file. A revision check that passes means the disk holds the bytes that hash to the base
revision — the same bytes — so a candidate that differs from the base differs from the disk, and
`candidate != source` in `save_document` is always true. `canSave`'s own doc comment says as much
(`rawEditor.ts`, *"so the control cannot send a candidate byte-identical to what the file holds"*).

Read rather than argued: a launch in which the shell wrote **exactly the text in the box** to the file
while the editor held it, and then the editor saved.

```
base revision before: 8a96f9d5…2ee4      disk revision after: 7aa2e153…5360
conflict outcome: Nothing was written. The file on disk is exactly as it was. …
```

A **conflict**, not *nothing to write*. So `browser.saveOutcome.nothingToWrite` is drawn by a branch
this screen cannot reach — the same category as `browser.rawSave.positionUnknown`, §10's fifth
deviation — and the
only paths to it are the two documented two-reads races of §8.1 and §8.3. Hole 8.13.

#### 9.10.4 A save drops the undo history

After every committed save the toolbar reads `[Undo DISABLED] [Redo DISABLED]`. The rebase starts a
fresh draft at the written text, so **what the file held before the save cannot be undone back to**.
That is defensible — the backup of §9.4 is the recovery route, and D4's *"`baseValue` is never
dropped … after a save, that is what was last written"* describes it — but the record nowhere says
the history goes, and a person who has typed a hundred keystrokes and saved will find out by trying.
Hole 8.14.

#### 9.10.5 Two arms drawn by code no reading here could reach

`browser.saveOutcome.windowOutOfStep` needs a committed save whose re-projection fails, and
`getDocument` over a file this application has just written successfully does not fail — an
unparseable one crosses as a view with `parsed: false`, not as an error. It was not read, and
`RawEditor.test.ts` is its only evidence. `browser.rawEditor.mayHaveWritten` is §9.9.

### 9.11 The re-take, after D13 and D14 and the second review pass

**Five launches, one plan each, every one to its own `--- end`.** The technique of §9.1 is unchanged
in every particular — same probe, same one-plan-per-launch rule, same fresh bundle path, same
`npm run build` then `cargo build -p espansoconfig --features custom-protocol` before each launch,
same redirected `XDG_CONFIG_HOME` and `HOME`, the real configuration never opened.

**The configuration for the re-take is three files, and two of them are a matched pair.**
`match/a-crlf.yml` is `crates/espansoconfig-core/tests/corpus/synthetic/crlf-line-endings.yml`
**copied byte for byte** — the committed fixture that exists for exactly this question, 375 bytes,
every line ending CRLF, verified with `cmp` after copying. `match/b-lf.yml` is that same file with
every `\r` removed (`tr -d '\r'`, 362 bytes), so the two differ **in nothing but their line
endings** and a difference in how the screen treats them can only be about carriage returns.
`match/c-plain.yml` is a small neutral LF file for the two conflict plans. A pre-run copy of the
CRLF fixture is kept outside the tree and `cmp`-ed against the live one after **every** launch.

#### 9.11.1 The CRLF refusal, on screen, in both languages (plan `crlf-refuse`)

```
crlf viewer file:   File match/a-crlf.yml
crlf viewer kinds:  This is the file itself, not the snippets read out of it.
                 // This file uses carriage returns in its line endings, and this editor cannot
                    give them back exactly as they are. Rather than rewrite every line ending in
                    the file without being asked, it will not open this file for editing.
crlf edit control:  ABSENT
crlf source box present: true
crlf editor section: ABSENT
crlf text area:      ABSENT
crlf all buttons:   [All 7] [match/a-crlf.yml 3] [match/b-lf.yml 3] [match/c-plain.yml 1]
                    [config/default.yml –] [:crlf] [:crlf-block] [:crlf-quoted]
                    [Hide this file’s text]
```

and in Spanish, with the same shape to the button:

> Este archivo usa retornos de carro en sus saltos de línea, y este editor no puede devolverlos
> exactamente como están. En lugar de reescribir todos los saltos de línea del archivo sin que nadie
> lo pida, no abrirá este archivo para editarlo.

Four facts, and each is one the fix exists to produce. **There is no *Edit this file's text* control
at all** — not a disabled one, not one that opens into a dead end. **The reason is drawn** where the
control would have been, beside the file-text scope sentence. **No editable box appears**, and no
`section.rawEditor` is mounted. And **the raw viewer still shows the file's text**, which is the half
that must not be lost: a file this editor will not write is still a file the owner can read.

**`cmp` against the pre-run copy after every one of the five launches: identical.** The committed
fixture's 375 bytes, its thirteen CRLF endings included, are exactly as they were. That is the claim
the whole fix exists to make, and it is the one made on disk rather than on screen.

#### 9.11.2 The LF twin still opens (plan `lf-twin`)

The same content, the same three snippets, the same everything but the carriage returns:

```
lf-before-edit viewer kinds: This is the file itself, not the snippets read out of it.
lf-before-edit edit control: Edit this file’s text
lf editor:      PRESENT
lf head:        File match/b-lf.yml Stop editing
lf box:         chars=360 cr=0 readonly=false
lf toolbar:     [Undo DISABLED] [Redo DISABLED] [Save this file DISABLED]
lf typed toolbar: [Undo] [Redo DISABLED] [Save this file]
lf typed head:  File match/b-lf.yml Unsaved changes Stop editing
```

**The refusal sentence is absent, the control is present, the box opens, and dirty still gates the
save.** That is what makes §9.11.1 a statement about carriage returns rather than about that
file — the pair differs by **thirteen bytes**, one per CRLF, and by nothing else, and the screen
treats them differently in exactly the way the model says it should.

One number in that transcript is worth reading rather than passing over: the file is **362 bytes** and
the box holds **360 characters**. The difference is the em dash in the fixture's first comment line,
which is three bytes and one character. That is the byte-versus-code-unit distinction this project
slices spans in Rust to avoid, showing up here as a harmless two — and it is also why a byte length
could never have been used as the cheap revision check §8.1 declined to take.

#### 9.11.3 A CRLF disk version cannot be loaded into a conflict (plan `crlf-disk`)

Reachable without contortion, and read: the editor was opened on the plain LF file, a line typed,
and then that file was rewritten from the shell **with CRLF endings** — so the conflict's disk
version is a text this editor cannot hold.

```
draft chars: 140            conflict box: chars=140 readonly=true
conflict choices: [Keep editing] [Copy my text] [Load the version on disk]
step two choices: [Keep editing] [Copy my text] [Discard my text and load it DISABLED]
step two markers: This file uses carriage returns in its line endings, and this editor cannot give
                  them back exactly as they are. …
```

The disk version's own text is still drawn through `SourceText`, beside all three revisions, so the
person can still **see** what the other writer left; the refusal sentence is drawn beneath it; and
the destructive control at the confirm step is **disabled** rather than silently doing nothing. The
draft is intact at 140 characters and the box is read-only, so nothing about the conflict's other
seven requirements changed.

#### 9.11.4 The clipboard: an honest negative with a named confounder (plan `clip`)

**It did not copy, and this reading cannot tell you whether that is this application's fault.**

```
copy control: Copy my text
document.hasFocus before the copy: false
clipboard API present: function      execCommand present: function
writeText rejected: name=NotAllowedError message=The request is not allowed by the user agent or
                    the platform in the current context, possibly because the user denied permission.
after copy, panel kinds: … Your text could not be copied to the clipboard. It is still in the box
                    above, so it can be selected and copied by hand.
box still: chars=140 readonly=true
carriers left behind: 0     active element: BODY
```

and the ground truth, taken from the shell: the clipboard was loaded with a sentinel before the
launch and `pbpaste` afterwards returned **the sentinel**. Nothing reached the system clipboard.

**The confounder, established rather than guessed.** `document.hasFocus()` is `false`, and
`lsappinfo front` resolves the frontmost application to **`loginwindow`**, with
`ioreg -n Root -d1 -a` reporting `CGSSessionScreenIsLocked = true`. **The machine's screen was locked
for the whole session.** Both clipboard routes require a focused document — the asynchronous API
rejects with `NotAllowedError` and `document.execCommand('copy')` returns `false` — so a locked
screen refuses both, for a reason that is about the machine and not about this webview. Bringing the
window forward was attempted twice and failed twice: `open -a` did not change `hasFocus`, and the
`System Events` route timed out with `-1712`, which is the same accessibility wall `1c-1-notes.md`
§10.2 recorded on this machine.

So three statements, kept apart because conflating them is how a hopeful positive gets written:

- **Known:** the draft did not reach the clipboard, the failure was **disclosed** in the panel, the
  box still holds the bytes for a manual selection, the offscreen carrier was **removed**
  (`carriers left behind: 0`) and focus was left somewhere sane (`active element: BODY`) rather than
  in a detached element. Those last two are the second review pass's §13.2 fix, and they are the part
  of D14 that a locked screen **can** demonstrate.
- **Not known:** whether `document.execCommand('copy')` succeeds in this application's WKWebView when
  the window is frontmost on an unlocked screen. Neither run of this reading could put it in that
  state.
- **Now doubtful:** §9.10.2's conclusion that *the webview refuses `navigator.clipboard`*. The first
  run was taken in this same session and shows the same symptom, and an unfocused document is a
  complete explanation for it. That conclusion is **withdrawn to "unsettled"**, and hole 8.12 is
  rewritten to say so.

**Settling it needs a person at an unlocked machine**, with the window frontmost, who clicks *Copy my
text* at a conflict and pastes. That is one minute of a human's attention and no amount of automation
substitutes for it; it is written down as the open question it is rather than closed by argument.

**One consequence is left deliberately unfixed, and named here so it is not missed.**
`RawEditor.svelte`'s doc comment on `copyBySelecting` still says the reading *"measured
`navigator.clipboard.writeText` being refused in the shipped WKWebView every time"*, which is the
claim this subsection has just narrowed. It is not touched here for the reason this whole section
exists: editing that file invalidates the reading that was taken over it, and a comment is not worth
a third run. It is a **known overclaim in a source file** — the same class as §13.1 — and the next
change to that component should correct it in the same commit.

#### 9.11.5 What the re-take did not re-take

The plans of §9.2 to §9.9 that the three changed files do not affect — the saved arm, the refusal and
its acknowledgement, the eight conflict requirements, the prohibited phrase, the leaving
confirmation, the in-flight guard, the determinate send failure. They stand as recorded. The judgement
that they are unaffected is a **reading of the diff**, not a re-run: D13 adds a door check at
`startRawEditor`, `editText`, `beginSave` and `loadDiskVersion` and a branded type around the drafted
value, and D14 changes one handler; none of them is in the path of a save that was already open on an
LF file. Where that judgement is wrong, it is wrong silently, and saying so is the only honest way to
report a partial re-take.

### 9.12 What this evidence is, and what it is not

**Evidence of:** what WebKit laid out and rendered in the real application's webview, read as
`getBoundingClientRect()`, element counts, `innerText`, `textContent`, `disabled`, `readOnly` and
code-point counts — plus, for four of the readings, **what the file on disk held afterwards**, which
is the strongest evidence in this document and the only kind that does not depend on the webview at
all.

**Not evidence of:** pixels. It cannot see the editor painted white-on-white, a `z-index` accident
that puts the outcome panel under the box, a text area whose monospaced face silently fell back to a
proportional one, a control scrolled out of view, or a focus ring that never appears. That remains
`1c-1-notes.md` hole 6, and this phase does not narrow it.

It is also not evidence about **pointer hit-testing**: every control here was activated through
`HTMLElement.click()`, which is the path a real click takes into `onclick` **after** the browser has
decided which element receives it. Nothing here shows that the *Save anyway* button is the element
under the pixels a person would aim at.

And it is not a regression test. It is a record of a screen at a moment, and the standing rule of this
project applies to it in full: **it must be re-taken after any change to `RawEditor.svelte`,
`DetailPane.svelte` or a string either of them draws.**

**That rule has already fired once, and §9.11 is what it produced.** Fixing what §9.10.1 and §9.10.2
found changed `RawEditor.svelte`, `DetailPane.svelte` and `rawEditor.ts`, so the first run describes
the program as it was when it was taken; the parts that describe behaviour those fixes replaced carry
a note pointing at the re-take, and the re-take itself is five launches over the changed screens.
**What is still an argument rather than a reading is §9.11.5** — that the plans not repeated were
unaffected. That judgement was made by reading the diff, and a wrong one fails silently.

**One thing the re-take taught about the instrument itself, worth carrying to the next phase:** these
readings are taken on a machine whose **screen is locked**, and a locked screen means no document can
hold focus. Everything that depends on focus — the clipboard, and anything else a browser gates on an
active document — is therefore unreadable this way, and a negative result about one of them is not a
result about the code. `document.hasFocus()`, `lsappinfo front` and
`ioreg -n Root -d1 -a | rg CGSSessionScreenIsLocked` are the three checks that tell the difference,
and the next reading that touches a focus-gated feature should run them **first** rather than
discovering the confounder afterwards, as this one did.

### 9.13 The probe, and its removal

**Twice, once per run.** Both probe files were restored from copies taken **before** the probe
existed and compared with `diff`: `main.ts IDENTICAL`, `main.rs IDENTICAL`, both times. `dist/` was
rebuilt from the reverted source and came back to **154 modules** each time.
`git status --short --untracked-files=all` shows neither file modified and no probe artefact anywhere
in the tree; every scratch path lived outside the repository and both scratch trees were deleted.
§11 is the re-run of every check afterwards.

---

## 10. Deviations from the brief, recorded rather than hidden

1. **`src/lib/browser/workspace.svelte.ts` gained two accessors**, `fileTextRevision` and
   `rawTextOf`, which the brief did not enumerate. The first is where the editor's base revision
   comes from and the second is the disk version for the file being edited; §5 and §8.6 are the
   arguments, §8.1 and §8.6 the residues.
2. **`src/lib/browser/invalidation.ts` was modified**, which the brief told 2c-1b not to redesign.
   `sealWholeDocumentSave` takes a third, required argument and an opened seal carries one more
   field. It is an extension rather than a redesign — no existing behaviour changed and
   `invalidation.test.ts`'s sixteen cases were adapted, not rewritten — and it is what the review's
   third finding asked for.
3. **`src/lib/browser/rawDocument.test.ts` was modified.** One assertion pins the raw viewer's
   toggle markup verbatim, and the toggle's condition gained `&& editing === null`. The assertion
   was updated and its comment now records both claims about that one condition.
4. **Nine `workspace.test.ts` cases were rewritten** to open the seal. That is a consequence of the
   §3 decision, not an independent change.
5. **`browser.rawSave.positionUnknown` is drawn but not exercised by a test**, because every
   fixture here gives the parser a position. `rawSave.test.ts` covers the model's own branch.

---

## 11. Verification

Every command run from the repository root, each as its own invocation. The table is the state
**after** the fix round, **after the window reading's probe was reverted**, **after the two defects
the reading found were fixed**, **after the second review pass of those two fixes**, and **after the
re-take of the reading and the removal of its probe**; before the fix round the frontend suite stood
at 868, before D13 and D14 at 883, and before the second pass at 892. Every row was re-run at the end
of the re-take and is what that run reported.

| Command | Result |
|---|---|
| `npm install` | clean; `jsdom` pinned at `30.0.1` |
| `npm test` | **894 passed** across 35 files (baseline 821; +73) |
| `npm run check` | 388 files, **0 errors, 0 warnings** |
| `npm run build` | Built, **154 modules** — the same count as before this phase's config change, which is the check that `resolve.conditions` did not leak into the build; and after the probe's removal it returns to the same asset hash it had before it |
| `cargo test --workspace` | **1007 passed**, 0 failed |
| `cargo clippy --workspace --all-targets -- -D warnings` | clean |
| `cargo fmt --check` | clean |
| `diff` against the pre-probe copies | `src/main.ts` and `src-tauri/src/main.rs` both **identical**, after each of the two probe rounds |
| `git status --short --untracked-files=all` | `package.json`, `package-lock.json`, `vite.config.ts`, seven files under `src/lib/`, and this record; four new files. **Neither probe file, and no probe artefact.** |

The five Rust commands are here because the probe touched `src-tauri/src/main.rs`; before the reading
this phase wrote no Rust and needed none, and after it that is true again.

---

## 12. The fix round — the review's six findings

`docs/reviews/phase-2c-1b-code.md` returned **`READINESS: NOT READY`**. This project holds a phase
open until its findings are closed, so no commit ever carries a demonstrated defect. What follows is
what was actually wrong. Nothing here is rewritten to look clean, and **two of the six were this
record claiming a guarantee the code did not give** — the same class of defect that produced two of
2c-1a's eight findings, one phase further on.

### 12.1 High — a projection could be installed under a held snapshot, and the editor paired them

The one path in this phase that could have lost a user's file, quoted in full in §5. Stale-identity
recovery installs a fresh projection; `readFileText` skipped the re-read because the document
identity had not moved; *Edit* then took its text from the old read and its revision from the new
projection, and the save's revision check passed. **§5's claim that the base could only ever be
older was false**: it reasoned about the order of two reads and the defect was a third event.

Fixed twice over: the revision is captured immediately before the text read and answered as
`fileTextRevision`, and `installView` drops a snapshot whose projection it replaces. §5 and §8.1 are
rewritten.

### 12.2 High — a save that may have written was drawn as "nothing was written"

`may_have_written: true` means the rename succeeded and a later step did not, so the file may already
hold the candidate. The workspace returned a bare `null` for every command failure and the editor
rendered every `null` the same way. That is `PROGRESS.md` D2 broken from the other side.

Fixed by a typed `RawSaveAnswer` whose `failed` arm carries `mayHaveWritten`, a two-armed
`SendFailure` in the session, and `browser.rawEditor.mayHaveWritten` in both languages.

### 12.3 High — a committed save this window could not re-project drew a clean success

`adoptTheReplacedDocument` reported its own re-read failure to the developer channel and returned
`void`, and the seal carried only the `SaveResult`. So the screen said *the file was written* while
the window was describing a file it had not been able to read back. **The first version's §8.3
recorded this as an accepted hole**; it was not one, it was a fact with nowhere to go.

Fixed by making the routine answer its failure, by carrying the status on the seal as a required
argument, and by `applySave` appending `windowOutOfStep` beside the saved arm. That hole is
**deleted** rather than reworded.

### 12.4 Medium — the editor could be closed while a save was in flight

Confirming the discard dialog unmounted the editor while an authorized request was still free to
commit — under a dialog that had just said the changes were not written. Fixed by disabling the
close control while saving, refusing in `requestClose` as well, saying that the save cannot be
stopped, and withdrawing a discard confirmation when a save starts.

### 12.5 Medium — the conflict's *Reload disk version* was lost to a click elsewhere

The disk version came from `browser.fileText`, which answers about the *viewer's* target. An editor
open on file A while the pane showed file B got `null`, and the destructive control stayed
permanently disabled — one of the eight requirements of split §6 lost to navigation, and **the first
version's §8.7 had recorded that as acceptable**. Fixed by keeping the conflict's disk text by document
(`captureTheDiskText`) and reading it through `BrowserState.rawTextOf(id)`.

### 12.6 Medium — the window reading

**Taken as its own step, after the other five were fixed**, which is the order the finding itself
implies: a reading of the pre-fix components would have been a record of code that no longer exists.
It is §9, and it is the only one of the six that changed no code and found two defects — a
`<textarea>` that normalizes CRLF (§9.10.1) and a clipboard that would not copy (§9.10.2). Both were
recorded as holes in the reading and fixed immediately after it, as D13 and D14.

**And then the rule the finding exists to enforce fired on the fixes themselves.** D13, D14 and the
second review pass's answers to them changed `RawEditor.svelte`, `DetailPane.svelte` and
`rawEditor.ts`, so the affected plans were **re-taken**: §9.11, five launches. The re-take confirmed
the CRLF refusal on screen in both languages, over the committed corpus fixture, with its bytes
untouched afterwards — and it found that §9.10.2's own conclusion was unsafe, because both runs were
taken with the machine's screen locked. That is the shape this project keeps meeting: the evidence
that catches a defect is the same evidence that catches the record overclaiming about it.

---

## 13. The second review pass — the two reading fixes, reviewed on their own

D13 and D14 went back to Codex as their own change and returned **`READINESS: NOT READY`** on one
High and one Medium. Both are fixed. The verbatim review is
`docs/reviews/phase-2c-1b-code.md` § "Second pass".

### 13.1 High — the CR invariant was not total, and D13 said it was

`editText(session, next: string)` applied no check, and `RawEditorSession` is a structurally
constructible interface, so from a valid LF session `editText(session, 'a\rb')` type-checked and
`beginSave` produced a candidate carrying a carriage return this editor could never read back. **The
running screen never does it** — a text area hands over an already-normalized value — and that is
precisely the point: the record had written a property of one component's behaviour as a guarantee of
the type system. Third occurrence of that class in this phase, and the sharpest, because the sentence
was in the section explaining why the design was safe.

Fixed by making the invariant **structural**: the drafted value is `RoundTripText`, a branded string
whose only constructor applies the check, so a bare `string` no longer type-checks into a draft, a
submission or a candidate. Fixed *also* by run-time guards at `editText`, `loadDiskVersion` and —
deliberately redundantly — at `beginSave`, which is the last line before a wire that replaces a
user's file. D13 now separates the three categories by name and says which of them is merely true of
today's component.

### 13.2 Medium — the clipboard fallback could throw out of its own cleanup

An unguarded `previous.focus()` in a `finally` meant a throw there escaped `copyBySelecting`, the
caller never assigned `copied`, and the person got **neither** disclosure — on the one control that
exists to keep a draft from being lost. Fixed: the function always answers a boolean, removal and
focus restoration are separately swallowed, and the **selection** is snapshotted and restored beside
the focused element (form-control offsets when there are any, document ranges otherwise), which the
first version did not do at all.

---

No corpus fixture was modified, nothing under `crates/` was modified, and no Rust was written. The
probe's two files were reverted and proved identical to copies taken before it existed (§9.13). The
working tree is left uncommitted.
