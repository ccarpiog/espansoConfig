# Phase 2c-2 step 2 — decision record

**The small editor's screen.** Step 1 built the whole editor as a value and deliberately touched no
`.svelte` file (`docs/decisions/2c-2-1-notes.md`); this step draws it, and pays the two kinds of
evidence step 1 could not: a **mounted-component test** and a **window reading**.

The authority for what the screen must do is still `docs/reviews/phase-2c-2-design.md` — the design
consult for the whole of 2c-2 — whose Q2, Q5 and Q7 are statements about a screen that only this step
could answer. Where this record and that document disagree, the consult is right and this is a bug.

Step 1's record numbers its own decisions **D1–D7**. This record does not re-use those names; its
sections are numbered and its decisions are named by what they decide.

---

## 0. The one thing to read first

**This phase produced eight instances of this project's named worst defect class — a record, comment
or user-facing string claiming a guarantee the code does not give.** Three were found by the window
readings, three by Codex's confirmation pass, two by the implementer's own audit afterwards. Every
one was fixed, and each is named below at the decision it changed. §3's table is the full list.

**Eight is this phase's own count and a stricter reading gives nine**, which is worth stating rather
than rounding: the code review's third finding — `MatchSaveAnswer`'s documented-but-untyped
`failure === null` invariant (§2.10) — is the identical shape in a **published type**, and its own
fix comment says so. Nothing turns on which number is used; what turns on it is that the class keeps
arriving by routes nobody is watching.

**Three of them were user-facing strings, which is new**: until this step the class had only ever
appeared in a decision record or a doc comment. A sentence on screen that overstates what the screen
does is the same defect with a wider audience, and nothing in the test suite, `svelte-check` or the
i18n parity checks can fail on it — the key exists, both languages have a value, and the value is a
lie.

**The practical rule that came out of it: check the notes against the code, never the code against
the notes**, and where TypeScript cannot force something, say so in the same sentence that describes
what it does force.

---

## 1. What this step built

| File | What it is |
|---|---|
| `src/lib/components/MatchEditor.svelte` | the screen: six fields, the toolbar, the three outcome arms, the send-failure panel, the leaving confirmation |
| `src/lib/components/MatchEditor.test.ts` | the mounted-component test — this project's **second** file to opt into jsdom, 26 cases |
| `src/lib/components/DetailPane.test.ts` | this project's **third**, 3 cases, over a **real** `BrowserState` — the only way the High finding's case could fail before the fix |
| `src/lib/components/DetailPane.svelte` | `MatchEditingSession`, the *Edit this snippet* control, `reprojectMatch` |
| `src/lib/browser/matchEditor.ts` | `ShownValue` and `shownValuesOf`, `needsReprojection` on the session, `Reprojection`/`ReprojectionRefusal`, `failureLines`, `acknowledgementOf` |
| `src/lib/browser/editorSave.ts` | `SendFailure.reason` and `sendFailureLines` — the failure chain, walked once rather than in markup |
| `src/lib/browser/workspace.svelte.ts` | `MatchSaveAnswer`'s third arm |
| `src/lib/i18n/{en,es}.json`, `index.ts` | **31 new keys** per language (513 → 544), **one reworded** (`readOnly.unmodelledShape`), one new accessor (`tReprojectionRefusal`) |

**No Rust was written.** Nothing under `crates/` or `src-tauri/` changed, and `cargo test
--workspace` is unmoved at 1008.

Three documents are the evidence rather than this one: `docs/decisions/2c-2-2-window-reading.md`
(four readings, §1–§31), `docs/reviews/phase-2c-2-2-code.md` (four findings, **NOT READY**) and
`docs/reviews/phase-2c-2-2-confirmation.md` (all four confirmed fixed, three more, **NOT READY**).

---

## 2. The decisions

### 2.1 The component is a walk, and every decision stays in the model

`MatchEditor.svelte` reads `matchEditorView(session)` and draws it. It holds two pieces of state — the
session, and whether a leaving confirmation is up — and no rule. That is not tidiness: it is why the
2c-2-1 review found seven findings in a phase with no screen at all, and why every one of this step's
four code findings was fixable in a value rather than in markup.

**Every control is controlled, not bound.** `value={field.text}` with an `oninput` that hands the
whole value to `editField` means the model is the only thing that decides what a box holds — so undo,
redo and the rebase a commit performs all take effect, and an edit the model refuses (during a save,
during a conflict, on a refused field, while a re-projection is owed) does not reach the buffer.
`bind:value` would have made the box the authority and the model a suggestion.

**What no type forces:** nothing stops a future component reading `session` directly and building its
own conclusions beside `matchEditorView`'s. What the arrangement buys is that today there is one
reader, and a rule added to the model reaches the screen without the screen being edited.

### 2.2 The snippet and its file are captured together — the review's High finding

`DetailPane.svelte` passed `match` as a captured `MatchView` and `file` as `browser.selectedDocument`,
which stays reactive. Open the editor over a snippet of file A, click anything in file B, and the
editor's header named **B** while `session.match` — and therefore every byte a save would write —
still pointed at **A**. A window naming one file while writing another is the worst thing this
application can be, and nothing inside `MatchEditor.svelte` could have caught it: the value arrived
already wrong.

The fix is one assignment: `editingMatch = { match: selected, file: inFile }`, a
`MatchEditingSession` captured in a single expression, so the two cannot come from two reads and
disagree afterwards. `RawEditor` never had the defect — its `file` prop has always been a captured
`DocumentSummary` — which is why the shape was available to copy.

**What forces it is the shape, not the type, and saying otherwise would be this record committing the
phase's own defect.** Both fields are plain values read at one instant into a `$state.raw` slot, so
neither can track the selection afterwards. A **type** cannot force that: `file: DocumentSummary |
null` accepts `browser.selectedDocument` read at any later moment just as happily, and a third prop
passed straight from the live selection would type-check exactly as this one did. What the interface
buys is that the capture is **one expression**, so a reviewer can see both halves at once.

`DetailPane.test.ts` exists for this one claim, and it is mounted over a **real** `createBrowserState`
rather than a stub. A hand-rolled stub is not reactive, so the selection could not move under the
mounted editor at all and the case would have passed before the fix as loudly as after it.

### 2.3 A re-projection is an obligation on the session, not a property of a panel

`needsReprojection` was derived — `saved !== null && saved.committed` — which quietly made it a fact
about a **panel**. Dismissing the saved panel through `keepEditing` cleared the outcome and with it
the only trace of the obligation, and the session went on editing against eligibility computed from
bytes the commit had replaced. That is the review's second finding.

It is now a field on `MatchEditorSession`, set by a committed save and cleared by **no transition that
resumes editing** — not by `keepEditing`, not by an undo, not by a dismissal. `startMatchEditor` over
a freshly projected snippet is the intended producer of `false`, and `isEditable` is `false` for as
long as the flag is `true`.

**The precise statement, because "cleared by nothing" would be one word too strong:** `applySave`
*assigns* `needsReprojection: result.committed`, so applying a **non-committed** save while the flag
is up would clear it. No reachable path does — `canSave` is `isEditable && isDirty`, so `beginSave`
answers `null` while the flag is up and no second save can start — but that is an argument about the
state machine, not a guarantee the assignment makes.

The reason the flag has to exist at all is `committedBaseline`: it moves `present` and `value` to what
was written and carries `eligibility` — and now `shown` — over unchanged with a spread, because the
new scalars' style, span and `decoded` flag are facts about bytes only Rust has seen. So after a
commit the baselines are right about *what the file holds* and stale about *what may be edited*.

The screen follows: after a commit it offers **the re-seed and no *Dismiss***. A *Dismiss* there would
be a control that puts the obligation out of sight without discharging it, which is precisely the
defect. When this window cannot answer the re-seed the control is **disabled with the reason beside
it**, never absent, so the state is never a dead end with nothing said about it.

**What the model forces:** no draft is built on eligibility the session cannot vouch for. **What it
cannot force** is that a caller *performs* a re-projection; a component that drew no way to re-seed
would leave a person with an editor that has stopped accepting changes. That is a dead end rather than
a data risk, and it is stated in `MatchEditorView.needsReprojection`'s own doc comment in the same
sentence as the guarantee.

### 2.4 A refused field shows its value — and the order is fixed in the code, not in the sentence

The first window reading found a `triggers:`-list snippet whose **triggers were invisible**: the field
drew its name and its refusal sentence with nothing between them, because the component drew
`field.text` and `projectedScalar` has no single scalar for a trigger list. Because the editor
replaces the whole detail pane while it is open (`2c-1b-notes.md` §2.10, D10), the triggers appeared
**nowhere in the window**. Measured, not inferred: `open triggersOnScreen: no`.

`FieldBaseline.shown: readonly ShownValue[]` is the fix, computed by `shownValuesOf` and surfaced on
`EditableFieldModel`. Three sources, one arm each: a refused **trigger** contributes the whole trigger
spec (every item of a `triggers:` list, a `regex:` pattern, both halves of a `Several`); an
**unmodelled** key contributes `UnknownEntry.value_text`, the same bytes the detail pane draws; anything
else contributes the field's own scalar.

**Then the second reading found the fix's own doc comment claiming source order while the code read
three fixed slots.** `shownValuesOf` walked `TriggerSpec`'s named slots in the order `trigger` →
`triggers` → `regex`, so a file writing `regex:` above `trigger:` drew them the wrong way round.

**The fix was the code, not the sentence, and that choice is the decision.** Weakening the comment to
*"in the projection's order"* would have been correct, cheap and available — and it would have shipped
a screen that presents a snippet's own trigger forms in an order the file does not use, with a true
sentence in a file nobody reading the screen will open. So the forms are now placed by the **first
byte of each form's value**: `ScalarView.span.start` for `trigger:` and `regex:`, and the **lowest**
`spanStartOf` among a `triggers:` list's items. The items *inside* a list are never re-sorted —
`TriggerSpec.triggers` crosses one item per source entry in source order and that order is kept, which
is the one place the phrase "source order" still applies.

The third reading measured the claim the only way it can be measured: the **same two values written
in the opposite file order draw in the opposite screen order**. A fixed slot order that happened to
agree with one of the two files would have passed a one-sided test.

### 2.5 Each shown value names the key it came from

The second reading's other finding: a `Several` snippet drew `:sev` and `sev[0-9]+` in two identical
unlabelled boxes, and the pane that distinguishes them was off-screen for D10's reason. `ShownValue`
now carries `source: DetailFieldName | null`, rendered with **`tDetailField`** — the detail pane's own
strings, so no new key exists for it.

**`tTriggerKind` would not do**, and that is worth writing down because it is the obvious reach: it
names the shape of the whole spec, not of one slot, and `Several` has no per-slot meaning at all.

`source` is `null` where the field's own heading already names the key — an `unmodelledShape` `label:`,
or the carriage-return `replace` — because repeating it under the box says nothing a reader does not
have. The window reading recorded the resulting cosmetic repetition honestly (a field headed *Trigger*
with a box named *Trigger*, and three list items each named *Triggers*) and judged it strictly better
than two identical boxes rather than pretending it was invisible.

### 2.6 The dead defensive branch is kept, and its comment names its own unreachability

`ValueView` has five arms and two of them — `Sequence` and `Mapping` — carry no span, so
`spanStartOf` answers `number | null` and `orderedForms` partitions the unplaced forms out. The
comment described that partition as a **live fallback with a named trigger**: *"exactly one shape
produces that: a `triggers:` list every item of which is a nested sequence or mapping."*

The third reading built exactly that shape and watched it draw **first, in file order** — located
after all. The reason is `scalar_sequence()` at
`crates/espansoconfig-core/src/model/project.rs:143`, the only writer of `TriggerSpec::triggers`: a
non-scalar item is not passed through as `Sequence` or `Mapping`, it becomes
`ValueView::Elided { kind, span, node }` carrying **that item's own span**. So every possible item is a
`Scalar` or an `Elided`, both of which carry a position, and `TriggerSpec::trigger`/`::regex` are
`ScalarView` and always do. **`position: null` is unreachable through `shownValuesOf`.** That is the
same defect class as §2.4, one level further in.

**The branch was kept and the comment was corrected**, rather than the reverse. Two reasons, and the
second is the load-bearing one:

- `ValueView` has five arms whether or not today's single Rust writer emits two of them, and a
  `MatchView` is a **boundary value** — nothing in TypeScript proves it came from that writer;
- deleting the branch would move the failure from "drawn in the wrong place" to "crashes or drops the
  value" the first time the projector widens.

So both doc sites now say what the code guarantees in practice — **the forms come out in the order the
file writes them** — and say in the same breath that the unplaced partition orders nothing today and
exists so a future widening cannot silently invent a position. The model suite covers the branch
(`baselineOf(unlocatable)`), which is the only coverage it can have.

### 2.7 A caption per arm, and a refusal that will not claim "the value is shown"

Codex's confirmation pass found the caption over the shown list claiming every entry was drawn *as the
file writes it*, while a `notScalar` entry renders a **localized shape name** — so a nested list in
`triggers:` was captioned "shown here as the file writes it" over the words *a list*, which the file
does not contain. Each entry now carries the caption that is true of it: `browser.detail.valueAsWritten`
on a `text` arm drawn through `SourceText`, and the new `browser.matchEditor.shapeOnly` on a
`notScalar` arm named through `tValueKind`. The blanket caption is gone from the DOM, not overridden —
the fourth reading's `fieldChildren` walk is the evidence.

The same pass found `browser.matchEditor.readOnly.unmodelledShape` saying the app *"cannot show what
it holds"* while the component draws `UnknownEntry.value_text` directly above it. It now says the app
cannot **edit** the key as a single text field and will not write over it.

**It was deliberately not reworded to "the value is shown."** That would be the identical defect with
the sign flipped: `shownValuesOf` answers `[]` when `value_text` is empty, and the component then draws
a name and a reason with no box at all. The sentence says only what is true in **both** cases. The
fourth reading could not construct the empty case from a window — a key with nothing after the colon
turns out to be `ownsNoBytes`, a different refusal — and says so rather than claiming the guard was
exercised.

### 2.8 The reprojection refusal is a typed reason, not a vaguer sentence

`browser.matchEditor.cannotReproject` gave one specific cause: *the window is no longer showing the
file the snippet is in*. The confirmation pass found two states that reach the same disabled control
under that same false sentence — selecting another snippet **in the same file** while a save is in
flight, and a commit whose adoption dropped the projection.

Codex's suggested fix offered a reason-neutral sentence *or* a typed reason. **The typed reason was
taken**, because a neutral sentence is a true sentence that helps nobody: the three states have three
different ways out, and *stop editing and pick the snippet again from the list* is not the same
instruction as *open the file again*.

So `reproject` answers `Reprojection` — `{ kind: 'projected', match }` or
`{ kind: 'unavailable', reason }` — over `ReprojectionRefusal = 'notProjected' | 'otherFile' |
'otherSnippet'`, with `reprojectionRefusalKey` a `switch` over literal keys and `tReprojectionRefusal`
the accessor. **A refusal with no reason is not representable**, which is the whole gain over
`MatchView | null`. A new member with no sentence is a compile error in `reprojectionRefusalKey`.

`DetailPane.reprojectMatch` decides the three by comparing the held selection's `document`, then
`node`, then `revision` — all three fields, so a person who clicked another snippet while the save was
in flight keeps their click and the editor is told this window has nothing to give it, rather than
being silently re-seeded from a different snippet.

### 2.9 A save that produced no outcome shows *why*, and the raw editor's cannot

`SendFailure` now carries `reason: IpcFailure | null`, and `sendFailureLines` walks the chain once, in
`editorSave.ts`: the rejection itself, then a `draftRefused`'s `DraftError`, or a `saveFailed`'s
`SaveError` and the `EditError` under its `Patch` arm. **The walk is in the model, not in markup**, so
how deep a screen goes is a decision a test can fail on; a decision written in a `.svelte` file is one
nothing in this repository can check.

That is what **wires** the 32 `code.draftError.*` and 36 `code.editError.*` sentences to a screen for
the first time — `save_match`'s commonest rejection is `draftRefused`, which is a **validation**
answer naming a field rather than an infrastructure failure, and it belongs beside the field the
person was editing. **Wired is not drawn**, and the difference is hole 2: the first reading drew the
patch-side chain in full (`IpcFailure` → `code.saveError.patch` → `code.editError.flowCollection`),
and **no `code.draftError.*` sentence reached a screen at all**, because the obvious provocation — a
duplicate mapping key — is a blocking hazard that withdraws *Edit this snippet* before anything can
be drafted.

`sendFailureOf`'s reason is **required, not defaulted**, for `applySave`'s `adoption` reason: a default
would be the function inventing *nothing is known* for a caller that did not look.

**The raw editor passes `null`, and that is a limit rather than a policy.** `RawSaveAnswer`'s failed arm
carries only `mayHaveWritten`, and widening 2c-1b's sealed boundary is outside this cut — so a raw save
that never left still sends the person to the developer console for the why. It is written into
`rawEditor.saveCouldNotBeSent`'s own doc comment, because a reader comparing the two functions would
otherwise take the difference for an oversight.

### 2.10 `MatchSaveAnswer` has three arms, because the documented invariant was not a typed one

The review's third finding. The `failed` arm was widened to carry a nullable reason under a comment
saying `null` happened only when no command ran — a comment asserting a guarantee the type did not
give. `{ kind: 'failed', mayHaveWritten: true, failure: null }` type-checked, so any alternate
`BrowserState` or component test double could produce it after running a command.

`notAttempted` now carries **neither** field, *because there is neither*: this state refused before any
command ran, so nothing was sent, nothing can have been written, and there is no rejection to hand on.
`failed` carries `failure: IpcFailure` **required**, because a command ran. The shape can no longer
describe a command that ran and rejected with nothing to say, and the component's three-way branch is
exhaustive.

### 2.11 Two markers were gated on the wrong thing, and the audit found them

Neither review caught these; the implementer's own sweep of every user-facing sentence against the code
did.

- **`browser.matchEditor.discardWarning`** — a key this step introduces — was first written as
  *"Your changes have not been written to the file. Leaving the editor discards them…"*, copied from
  the raw editor's. The first sentence is **false** after a `mayHaveWritten` send failure, where the
  whole point of the arm is that this application cannot tell. It was corrected before the commit and
  now says only what leaving does: the changes in these boxes are discarded and cannot be brought
  back.
- **`browser.matchEditor.fieldRemoved`** — *"This key will be taken out of the file when you save"* —
  was gated on `field.removed`, the buffer's flag. After a **committed** removal the buffer still
  carries `removed` while the file no longer has the key, so the marker went on promising a future
  write of something already written. It is now gated on `field.intent === 'Remove'`, which is what a
  save would actually say about the field; `fieldIntent` answers `'Unchanged'` for a removal of a key
  the baseline no longer has, so the marker disappears exactly when the promise stops being true.

**One latent instance was found and deliberately not changed.**
`browser.rawEditor.discardWarning` carries the identical false wording and is reachable the same way —
a `mayHaveWritten` failure in the raw editor, then *Stop editing*. It is 2c-1b's published string and
the raw editor's markup is outside this cut; fixing it here would mean re-taking 2c-1b's window reading
for a string this phase does not draw. It is hole 12 below rather than a silent carry-over.

### 2.12 The window reading as instrument: what it cost and what it settled

Four passes, **26 launches**, each one plan into a fresh bundle path over a freshly rebuilt
configuration, per `1c-2b-2b-2-notes.md` §6.1. Every launch reached its own `--- end` and every
`probe.err` was zero bytes, so no transcript is a partial run rounded up to a conclusion. Synthetic
fixtures written for the run, outside the repository; **the owner's real configuration was never
opened**.

Two things came out of it that outlive the phase.

**The webview's `localStorage` is not keyed by `HOME`.** A language override set by one launch was
still in force in the next, from a different bundle path, with a `HOME` created seconds earlier — the
WebKit data store follows the **bundle identifier**, which every probe bundle shares. Two launches
were lost to it before the cause was found. This **contradicts `2c-1b-notes.md` §9.1**; that record was
left exactly as written and the correction is in `CLAUDE.md` §6, because rewriting an old reading to
match a later measurement destroys the evidence that the measurement was ever wrong. The standing fix
is to set the language **explicitly through the picker** at the top of every plan.

**The two controls normalize a carriage return differently, and neither can produce one.** Measured in
the shipped WKWebView: a `<textarea>` assigned `"x\ry\r\nz"` reads back `"x\ny\nz"` — bare CR and CRLF
both collapse to one LF, which is 2c-1b's finding — while an `<input type="text">` assigned `"p\rq"`
reads back `"pq"`, **deleting** the character rather than converting it. That completes the consult's
Q7 as far as a window can, and it is why a projected value holding a real carriage return is drawn
through `SourceText` rather than into any box: a `<textarea>` would draw it as an ordinary line break,
misdrawing the file even while refusing to write to it.

**That measurement is a fact about this machine's WKWebView, not a guarantee the code gives**, and the
three gates of step 1's D3 stay exactly where they are for that reason. `beginSave`'s gate in
particular exists because `MatchBuffers` carries **no brand** and a caller that is not a control
type-checks; no path in this window can provoke it, so its evidence stays the model suite's (hole 1).

---

## 3. What each round caught

| Round | Findings | The class |
|---|---|---|
| Codex review 1 | **High** — `DetailPane` captured the match but read `file` reactively (§2.2) | a screen naming one file while writing another |
| | **Medium** — reprojection was optional; *Dismiss* resumed editing on carried-over eligibility (§2.3) | a documented protocol the code did not enforce |
| | **Medium** — the `failure === null` invariant was a comment, not a type (§2.10) | **the worst class** |
| | **Low** — a mounted test claimed 21 fields unchanged while sampling 5 | a test claiming more than it checked |
| Reading 1 (11 launches) | a `triggers:`-list snippet's triggers were invisible (§2.4) | a screen silently showing nothing |
| Reading 2 (7 launches) | `shownValuesOf` claimed source order and read fixed slots (§2.4) | **the worst class** |
| | the shown boxes were unlabelled (§2.5) | presentational |
| Reading 3 (3 launches) | the unlocated-form branch is unreachable, and the comment sold it as live (§2.6) | **the worst class** |
| | `matchEditor.ts`'s module header said the carriage return is refused *twice* while three gates existed (§2.12) | **the worst class** |
| Reading 4 (5 launches) | no new defects — all four targeted items passed | — |
| Codex confirmation | the blanket caption claimed bytes over a shape name (§2.7) | **the worst class**, on screen |
| | `unmodelledShape` said the app cannot show what it shows (§2.7) | **the worst class**, on screen |
| | `cannotReproject` named one cause where three are possible (§2.8) | **the worst class**, on screen |
| Implementer's audit | `discardWarning` claimed nothing was written (§2.11) | **the worst class**, on screen |
| | `fieldRemoved` was gated on the buffer, not the intent (§2.11) | **the worst class**, on screen — a promise outliving its truth |

**Nine of the fifteen rows are the same class** — the phase's own eight plus the code review's third
finding — and the pattern is what matters more than the arithmetic: the first three
rounds found it in **comments**, the last two found it in **sentences a person reads**. The mounted
tests found none of them. Neither did `svelte-check`, the i18n parity tests or the markup scan —
every one of those checks that a key exists and is translated, and every one of the false keys
existed and was translated.

**The reviews and the readings found different things and neither subsumes the other.** Codex found
three of the four code findings by reading types; the readings found four defects no type could
express, three of them about what a window does or does not draw. Reading 4 found nothing, which is
what a reading looks like when the fixes are real.

---

## 4. Holes this step leaves open

1. **`beginSave`'s carriage-return gate is not reachable from a window.** No control in this editor can
   produce a `\r` (§2.12), so the gate that exists because `MatchBuffers` carries no brand can only be
   driven by a caller that is not a control. Its evidence is the model suite's, permanently, unless a
   later editor gives a buffer another way in.
2. **`code.draftError.*` cannot be drawn from this screen at all**, and the reason is structural rather
   than a gap in the plans: the obvious planner-side provocation is a duplicate mapping key, which is a
   `HazardKind::DuplicateMappingKey`, which makes the match not safely editable, which withdraws *Edit
   this snippet* — so `AmbiguousKey` can never be drafted from a window. The 32 sentences are wired and
   `sendFailureLines` walks to them; only the patch-side chain (`code.saveError.patch` →
   `code.editError.flowCollection`) was seen on a screen.
3. **One eligibility refusal was never provoked on a screen.** Four of the five were:
   `carriageReturn`, `triggerNotSingle` (in four shapes), `unmodelledShape` and `ownsNoBytes`.
   **`notDecodable` was not**, so the `shownValuesOf` arm that serves it — the plain
   `projectedScalar` fallback — has model-suite evidence only.
4. **The `[]` guard for an empty `UnknownEntry.value_text` was not exercised from a window** (§2.7).
   Both non-scalar shapes tried have non-empty source text, and the shape that has none is a different
   refusal. The guard is what makes `unmodelledShape`'s reworded sentence survive, and it is covered by
   a model test alone.
5. **Two of the three outcome arms were never on a screen** — no conflict and no `refused` verdict —
   and neither was an identity-stale save nor the in-flight guard beyond the ordinary case. The
   conflict arm in particular draws three revision sentences and a *Keep editing* control that no
   reading exercised. The `saved` arm and one `sendFailure` arm are all a window has confirmed.
6. **`reproject`'s `notProjected` arm was not provoked.** It needs a commit whose adoption dropped the
   projection, or a same-node-different-revision selection; this window offers a path to neither.
   `otherFile` and `otherSnippet` were both read on screen.
7. **`code.commandError.documentHasNoMatchList` still cannot be drawn.** `match_list_of` in
   `src-tauri/src/commands.rs` has exactly one caller, `create_one_match`, so only `create_match`
   produces it. It belongs to **2c-3a**.
8. **The raw editor's send failure still shows no reason** (§2.9). `RawSaveAnswer`'s failed arm carries
   none and 2c-1b's sealed boundary was out of this cut.
9. **A person who pastes CRLF text into the replacement box gets LF written**, and nothing on screen
   says so at the moment of typing. That is a change to a value they are editing rather than to bytes
   they never touched, so it does not break the preservation promise — but this application currently
   cannot write a carriage return into a value at all, and the screen is silent about it.
10. **The unplaced partition of `orderedForms` is unreachable through the running application**
    (§2.6). It is defensive, both doc sites say so, and only a model test drives it.
11. **The probe measures the DOM and layout geometry, and nothing else.** Pixels beyond a rectangle
    (white-on-white, a `z-index` accident, a font that failed to load), pointer hit-testing, and real
    keystrokes — composition, autocorrect, IME — are all outside it. Unchanged from 1c-1 §10.3.
12. **`browser.rawEditor.discardWarning` still carries the false wording** (§2.11), reachable the same
    way, deliberately left for the sub-phase that touches the raw editor's markup.
13. **The real configuration was never opened by any of the four readings.** Every fixture was
    synthetic and hand-written for the run. The small editor has not been driven over the owner's own
    files, and Phase 2c's exit — a week of real use — is what will do that.
14. **Eligibility and `shown` are stale between a commit and a re-seed**, by construction (§2.3). The
    session refuses changes for exactly that reason, and the fourth reading recorded the visible
    consequence honestly: a removed field's box still holds the old text while the sentence under it
    describes an absent key. Both are true, no action is possible in that state, and *Read this snippet
    again* clears it.
15. **The Spanish sentences are checked by the parity tests and the untranslated-value heuristic
    only**, which is `2c-1b-notes.md` §8.8 unchanged. Three of the four readings took a Spanish pass
    and each confirmed that the new strings render and that the geometry is identical to the pixel;
    none of them is a review of the wording.

### 4.1 Three more of the same class, found while writing this record and fixed in the same pass

Not open holes — closed before the commit — but recorded because **where** they were is the useful
part.

1. **`PROGRESS.md` § Key paths said `saveMatch` is not wired into `BrowserCommands`.** It has been
   since 2c-2-1. Corrected, and the entry now names what *is* still unwired (`createMatch`,
   `deleteMatch` — 2c-3a's) rather than a list that was true once.
2. **The same section called `RawEditor.svelte` "the only component with a mounted test."** There are
   three. Corrected without losing the sentence's point: the harness is scoped by **docblock opt-in**,
   `environment: 'node'` stays the default, and the components with no mounted test are deliberately
   not back-filled — each of the three that has one gained it in the sub-phase that changed it.
3. **`MatchEditor.svelte`'s header said "seven things in the markup below are load-bearing" over
   nine.** Fixed by removing the number rather than correcting it: a count in a comment above a list
   that grows is the same defect with a fuse on it.

**Two of the three were in `PROGRESS.md`'s own Key paths section, and both had survived several
sub-phases unnoticed.** A third was found in the sweep that followed: the same section still called
**154** *the* module guard, three rebaselines out of date. **The Key paths section is not
self-maintaining and drifts silently** — nothing tests it, nothing links it to the code it describes,
and it is read exactly when a fresh session is least able to tell that it is wrong. Sweep it as part
of any phase that changes what a listed path does.

One further staleness was found and **deliberately left**: the table carries two rows for
`src-tauri/src/commands.rs`, the current one (*eleven commands, five of which write*) and a retained
older one from 2b-2b-3 (*eight commands, two that write*). Older rows are kept by convention, the
correct row sits above it, and rewriting a historical entry is a different act from correcting a live
claim.

---

## 5. Verification

Every command below was run at the final state — after the last fix round and after the fourth window
reading's probe had been removed.

| Command | Result |
|---|---|
| `npm test` | **1020 passed, 38 files** (974 / 36 after step 1) |
| `npm run check` | 394 files, **0 errors, 0 warnings, 0 files with problems** |
| `npm run build` | exit 0, **158 modules**, no `svelte/internal/server`, no `node:async_hooks` |
| `cargo test --workspace` | **1008 passed, 0 failed** — unmoved, because no Rust was written |
| `cargo clippy --workspace --all-targets -- -D warnings` | exit 0 |
| `cargo fmt --check` | exit 0 |
| `cargo tree -p espansoconfig-core \| rg tauri` | no output — the architecture rule holds |
| dictionary keys | **544 in each language**, parity clean |

**The module guard moved from 156 to 158, and the shape of the move is the check rather than the
number.** The two are `MatchEditor.svelte` and `src/lib/browser/matchEditor.ts` — the latter existed
after step 1 but no component imported it, so it was tree-shaken out. `+2` is exactly the number of
source modules a screen over an existing model adds. **The regression this guard exists for is a jump
to ~180 with `svelte/internal/server` in the bundle**; that is absent, and `vite.config.ts` was not
touched. Rebaseline by building a pristine `git archive HEAD` copy and subtracting; never by editing
the `resolve.conditions` condition.

The probe was removed **four times**, once per reading. `src/probe.ts` was deleted and `src/main.ts`
and `src-tauri/src/main.rs` were restored from copies taken **before** the probe first existed and
compared with `diff` — `main.ts IDENTICAL`, `main.rs IDENTICAL`, every time. Every scratch path lived
outside the repository, and `git status --short --untracked-files=all` afterwards holds no probe file
and no probe artefact.
