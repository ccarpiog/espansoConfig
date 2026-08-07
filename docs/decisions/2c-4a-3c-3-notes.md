# Phase 2c-4a step 3c-3 — the fixes

`docs/decisions/2c-4a-3c-2-window-reading.md` §10 found **one High, two Mediums, two Lows and four
Observations** over the conflict panels of the six write surfaces. This step fixes §10.1–§10.5 and
takes the reading again; the re-take is `docs/decisions/2c-4a-3c-3-retake.md` and is the evidence
for every *closed* below. **The probe harness stays in the tree** — removing it is the next step.

---

## 1. What changed

| File | What |
|---|---|
| `src/lib/i18n/en.json` | 2 new keys, 1 reworded (§2.1, §2.2, §2.4) |
| `src/lib/i18n/es.json` | the same 2 keys, the same 1 reworded |
| `src/lib/browser/saveOutcome.ts` | `conflictChoiceKey` branches `keepEditing` on the draft kind; the doc comment that said the opposite is corrected |
| `src/lib/browser/rawEditor.ts` | `rawEditorDiskRefusalKey`, a second key function over the same refusal |
| `src/lib/i18n/index.ts` | `tRawEditorDiskRefusal`, the accessor over it |
| **`src/lib/components/reveal.ts`** | **new** — `outcomeReveal` and `revealOutcome` |
| `src/lib/components/RawEditor.svelte` | the reveal; the disk refusal's own accessor |
| `src/lib/components/MatchEditor.svelte` | the reveal |
| `src/lib/components/MatchCreator.svelte` | the reveal |
| `src/lib/components/MatchDeleter.svelte` | the reveal |
| `src/lib/components/MatchMover.svelte` | the reveal |
| `src/lib/components/MatchDuplicator.svelte` | the reveal |
| `src/lib/browser/matchMove.ts`, `matchDeletion.ts`, `matchDuplication.ts` | two comments each, which named a label that has moved |
| **`src/lib/components/reveal.test.ts`** | **new** — 11 cases |
| `src/lib/i18n/dictionaries.test.ts` | the wording invariant §10.1 asked for, +3 cases |
| `src/lib/browser/saveOutcome.test.ts` | the `keepEditing` branch, +1 case; one existing case corrected |
| the six mounted component suites | +20 cases between them |
| `src/probe.ts` | three temporary additions for measuring the fix (retake §1) |

Nothing in `src-tauri/` changed. Nothing in `crates/` changed. **No wire type, no command, no
transition and no state machine changed** — every fix is a sentence, a label or a scroll.

---

## 2. The five findings

### 2.1 §10.1, the High — the Spanish creator line claimed the snippet had been written

`browser.matchCreation.revisionExpected` in `es.json` read *"Este fragmento **se ha escrito** sobre
la versión {revision}."* — present perfect passive — four lines under *"No se ha escrito nada. El
archivo del disco sigue exactamente igual."* It is now:

> Este fragmento **se redactó** sobre la versión {revision}.

*redactar* is to draft or compose, which is the family the five siblings use: the editor's *se
cargó desde*, the deleter's *se leyó de*, the mover's and the duplicator's *se decidió sobre*. The
reading suggested this exact wording and it is taken.

**The English moved with it, and that was a decision rather than a consequence.** §10.6 recorded
*"This snippet was **written against** version {revision}"* as an **Observation and not a defect** —
*written against* is drafting, so the sentence is sound — and asked 3c-3 to decide deliberately
whether to move it, with the note that *"a fix that only touches Spanish leaves the trap in place"*.
It is now:

> This snippet was **drafted against** version {revision}.

**Why moved rather than left.** Three reasons, in the order they weighed.

1. **The trap is the point.** §10.6's whole content is that this line is the *reason* §10.1 was easy
   to mistranslate: it was the only one of the six using the verb *written* at all, on a panel that
   opens with *Nothing was written*. Leaving it leaves the next translator — of a third language, or
   of a reworded panel — the same footing that produced a High.
2. **A test can only guard what is uniform.** The invariant added below is *no `revisionExpected`
   line uses a verb of writing*, checked in both locales over all six keys. With the English left as
   it was, either the guard is English-exempt — a suppression list of exactly the string that caused
   the problem — or it does not exist. A rule with a hole where the defect was is worse than no rule.
3. **The cost is one word and no meaning.** *drafted against* says exactly what *written against*
   said. It also matches this project's own vocabulary: the value the sentence is about is a
   `Draft<CreationBuffers>`.

**What was rejected.** *composed against* (stilted), *based on version* (weaker — it drops that this
is the base a save is checked against), and *"This snippet has not been written; it was prepared
against version …"* (restates `nothingWasWritten`, which the shared line already says, and two
wordings of one guarantee is `saveOutcome.ts`'s named failure mode).

### 2.2 §10.2, a Medium — three panels offered *Keep editing* where nothing is being edited

`conflictChoiceKey` in `src/lib/browser/saveOutcome.ts` branched `confirmReload` on
`ConflictDraftKind` at 2c-4a-3b — that is why *Close this and load it* exists — and returned
`browser.rawSave.choice.keepEditing` **unconditionally**. So the deleter, the mover and the
duplicator drew *Keep editing* / *Seguir editando* beside a panel about a deletion, a move and a
copy.

The branch is added, with one new key per language:

```
browser.saveOutcome.choice.keepOperation   "Leave this as it is"  /  "Dejarlo como está"
```

**The naming follows the precedent 2c-4a-3b set one field along.** `operationKeptInMemory` is the
`operationChoice` half of `draftKeptInMemory`; `keepOperation` is the `operationChoice` half of
`keepEditing`. The reading suggested *Leave this as it is* / *Dejarlo como está* as "the shape" and
left the naming to this step; it is taken as written, because it says what the control does — the
panel goes and the operation stays set up — without naming an activity.

**The doc comment is corrected in the same change, and that is not a courtesy.** It said the label
*"reuses the raw editor's own label rather than adding a second string that reads the same: it is
the same offer, made about a different refusal."* That was written before the operation-choice
panels existed and had become a **justification for the defect** sitting three lines above it. A
sentence in the code that argues for what the window reading called wrong is exactly the class
`CLAUDE.md` §6 names, and leaving it would have made the next reader defend it. It now says what
changed, why, and that this is a **narrower instance of the finding 3b closed for the sentences on
these same three surfaces** — the *sweep for what the type now says, not for the words the old
finding used* failure, made once more.

**The sweep this time went past the function.** Six comments in `matchMove.ts`, `matchDeletion.ts`
and `matchDuplication.ts` said *"\*Keep editing\* resets the step"* and *"\*Keep editing\* writes
NOT_RELOADING back"*. They named a **label**, and the label has moved on those three surfaces; they
now name the `keepEditing` **choice**, which is stable, and one of the pair says what the label is
and why. The three authored-text models' identical comments are untouched and still true.

**What is deliberately out of scope, and recorded rather than fixed:** `rawSave.ts`'s
`RawSaveChoice` also has a `keepEditing`, drawn by `tRawSaveChoice` on the **refused** arm of all
six surfaces — so a refusal-with-findings on the deleter, the mover or the duplicator still says
*Keep editing*. It is the same defect one arm along. It is **not** fixed here because
`refusalChoices` carries no draft kind, giving it one is a signature change to a module three
sub-phases older than this finding, and **no window reading has ever drawn that arm**
(`2c-4a-3c-2-window-reading.md` §11.9: *no refusal-with-findings path was on any transcript*). Fixing
a sentence nobody has seen, on the strength of a reading that did not see it, is how the previous
round's fix became the next round's finding. §4.1.

> **CORRECTION, 2c-4a-3c-4. The deferral above was unsound and the aggregate review overruled it.**
> `docs/reviews/phase-2c-4a-3c-code.md` returned **NOT READY** with this as its Medium, and the
> refutation is worth keeping verbatim: *the age of `rawSave.ts` does not make its current output
> truthful, and absence from a prior window transcript is a gap in evidence, not evidence that a
> reachable label is correct.* Two further points the paragraph above got wrong:
>
> - it called the arm unseen while naming, three sub-phases earlier, the path that draws it. **The
>   duplicator's acknowledgeable refusal is that surface's documented ordinary first outcome** — a
>   byte-exact copy keeps its source's trigger definition — and `MatchDuplicator.test.ts` had
>   *already* been driving it through the controls a person clicks since 2c-3c-3. "Nobody has seen
>   it" was true only of window transcripts, and that is the gap a reading fills rather than a reason
>   to leave a label wrong;
> - the reasoning is circular in exactly the way the record was trying to warn against: 3c-2 found a
>   narrower arm the earlier round had missed, and this paragraph then decided to leave the next
>   narrower arm. That is *sweep for what the type now says, not for the words the old finding used*
>   failing a third time in one phase.
>
> The signature change turned out to be one line wide, and on the **accessor** rather than on the
> choice: `rawSaveChoiceKey(choice, draftKind)` and `tRawSaveChoice(choice, draftKind)`.
> `refusalChoices`, `offeredRefusalChoices` and all six views that carry their answer are untouched,
> and `RawSaveChoice` gained no third member — a `keepOperation` value would have grown an
> unreachable arm in each of the six components' exhaustive `switch`es. The branch itself is in
> `src/lib/browser/draftKind.ts` now, shared with `conflictChoiceKey` and with
> `reloadUnavailableKey`. The record is `docs/decisions/2c-4a-3c-4-notes.md`; the window transcript
> the paragraph above says does not exist is `docs/decisions/2c-4a-3c-4-retake.md` §3.

### 2.3 §10.3, a Medium — the panel was drawn below the fold and nothing scrolled to it

At 1180 × 728 the match editor's conflict panel opened at **y = 720** in English and **y = 771** in
Spanish, 1 044 px tall, with `section.detail`'s `scrollTop` at `0` and no code moving it. A person
who pressed *Save this snippet* and hit a conflict saw eight pixels of it in English and **none of
it** in Spanish — no *Nothing was written*, no revisions, no draft, no controls — with the editor
above unchanged in size and position across the save, so nothing visible marked that anything had
happened. On all six surfaces the **controls** were below 728.

**The fix is `src/lib/components/reveal.ts` plus two `bind:this` and one `$effect` per surface.**

```ts
outcomeReveal(arm: OutcomeArm | null, awaitingConfirmation: boolean): 'none' | 'panel' | 'choices'
revealOutcome(reveal, panel: HTMLElement | null, choices: HTMLElement | null): void
```

Four decisions in it, each with a reason a later reader can check.

1. **It is in `src/lib/components/`, not `src/lib/browser/`.** The reading says so — *"it is the
   panel's own concern, not the model's"* — and pointing a viewport is a question only a document
   can answer. But the *reason* the browser-directory rule exists is that a decision written into a
   renderer is carried by that renderer's mounted suite alone and a second renderer can omit it
   while walking the model faithfully (2c-3c-3's Medium). Six copies of the same three lines would
   have been exactly that. So the decision is an ordinary function with an ordinary suite, in the
   directory where DOM machinery lives, beside `clipboard.ts`, which exists for the same reason.

   > **CORRECTION, 2c-4a-3c-4.** Half right, and the aggregate review's third finding is the other
   > half. The `scrollIntoView` machinery is DOM machinery and stays; **`OutcomeArm`,
   > `OutcomeReveal` and `outcomeReveal` were not** — they decide from save-model state what has to
   > be revealed, which is a rule, and the file restated the browser model's arm union as three
   > literals *specifically to avoid depending on `src/lib/browser/`*. Avoiding the dependency is the
   > reverse of the architecture rule rather than a way of satisfying it. They are in
   > `src/lib/browser/saveOutcome.ts` now, where `OutcomeArm` is derived from `SaveOutcomeModel`
   > rather than written out, so a new save arm is a compile error in `outcomeReveal`. The paragraph
   > above is still exactly right about *why* the shared function exists at all — six copies in six
   > markup files is the failure it prevents — and that argument does not decide which directory it
   > lives in.
2. **`block: 'start'` when the panel appears.** The first line of a conflict panel is *Nothing was
   written*, and that is the sentence the reading found nobody could see. Framing the controls
   instead would put the destructive choice on screen and the statement that nothing had happened
   off it.
3. **It is every arm's, not the conflict's.** `outcomeReveal` answers `panel` for `saved` and
   `refused` too. `2c-3c-3-window-reading.md` §10.2 recorded the same class as a **Low for the
   committed panel**, and narrowing this to conflicts would have left that one open for no reason
   anybody could state. The retake's L48 is the window evidence, and `RawEditor.test.ts` carries the
   case that would fail if a later edit narrowed it.

   > **CORRECTION, 2c-4a-3c-4.** The intent was right and the implementation did not carry it. One
   > shared `'panel'` value for all three arms meant a component's `$effect` depended on a cue that
   > **did not change when one arm replaced another** over the same bound element — so the ordinary
   > *Save anyway* path, where `beginSave` retains the refusal in flight and `saved` replaces it with
   > no `null` interval, need not have re-run the effect at all. That is the review's second finding.
   > The cue now has arm identity — `savedPanel`, `refusedPanel`, `conflictPanel` and
   > `conflictChoices` — and all three panel values still map to `block: 'start'` in the DOM helper,
   > so nothing about *where* anything is scrolled changed. Each of the six mounted suites carries an
   > arm-to-arm case that clears the scroll spy before the second result; the window evidence is
   > `2c-4a-3c-4-retake.md` §4.
4. **It never throws.** `Element.prototype.scrollIntoView` is absent in jsdom and can be absent or
   refused in an embedded webview. Everything the panel says is already on the page; losing it to a
   failed scroll would be strictly worse than not scrolling. `reveal.test.ts` asserts jsdom's
   absence as the platform condition the guard is written against, before it stubs it.

**What no type forces**, in the same sentence as what it does: `revealOutcome` cannot check that a
component bound the elements it hands over, or that the `$effect` exists at all. Both are deletable
in silence, so each of the six mounted suites carries a case for them, and §5.2 of the retake proves
by mutation that they fire.

### 2.4 §10.4, a Low — the second step's control was pushed out by the sentence that justifies it

Pressing *Load the version on disk* adds the surface's confirmation line, and on the longest panels
that growth moved the confirmation control back out of the viewport — y = 771 (creator, en), y = 788
(creator, es), y = 771 (editor, es) — **after** the pane was already scrolled to its end. The reading
noted that a fix for §10.3 does not necessarily fix this one, and it is right: content growing
downwards past a fixed `scrollTop` needs a second reveal with a different target.

That is `OutcomeReveal`'s third value. When the reload reaches its confirmation step the cue becomes
`choices` and the **row of controls** is revealed with `block: 'end'`. It falls back to the panel
when no row is bound — a component that changed its markup gets the previous behaviour rather than
silence.

The five match surfaces answer *am I at the confirmation step* with `awaitingReloadConfirmation`;
**the mover answers it with `reloadWarning !== null`**, which is `matchMove.ts`'s own arrangement
(*"non-`null` is exactly the boolean the other five surfaces carry, replaced here rather than joined
by a second field"*), and `MatchMover.svelte` reads that. The retake's L41/L42 are what say it read
the right one.

Fixed, not deferred: y = 666–667 with `inView=true` on all six surfaces in both languages
(retake §3.4).

### 2.5 §10.5, a Low — the refused-reload sentence named the wrong door

When the version on disk holds a carriage return the raw editor disables the reload confirmation and
draws `view.diskRefusal` beside it. That drew `browser.rawEditor.lineEndingsNotPreserved`, which ends
*"…it will not **open this file for editing**"* — the reason for a **disabled reload confirmation**,
carried by a sentence about a **different** control, on a panel where the editor is open and the
person's draft is in the box.

`rawEditorRefusal` is called twice over two different texts, and the two calls now have two key
functions:

```
rawEditorRefusalKey(refusal)      → browser.rawEditor.lineEndingsNotPreserved      (opening)
rawEditorDiskRefusalKey(refusal)  → browser.rawEditor.diskLineEndingsNotPreserved  (reloading)
```

**Two key functions over one union rather than a second union, or a `scope` argument.** The refusal
is genuinely the same fact — a carriage return this editor cannot give back — and only the door
differs; a `scope: 'open' | 'reload'` parameter would make the door a **caller's assertion**, which
is the shape `saveOutcome.ts` refused for `describeRawSave` (*"`describeSaveOutcome(rawRefusal,
'edit')` suppresses it and `describeSaveOutcome(editResult, 'wholeDocument')` invents it"*). A new
arm of `RawEditorRefusal` is a compile error in **both** functions, which is what a `switch` over
literal keys buys.

The new sentence keeps the policy verbatim — *rather than rewrite every line ending in the file
without being asked* — names the reload, and adds *Your own text is untouched and the file is not
written either way*, which is true of this arm and is what a person looking at a dead control needs.
`view.diskRefusal` was already a separate field from the editor's own opening refusal, so this cost
one accessor and no restructuring, exactly as the reading predicted.

---

## 3. The keys

Two added, one reworded, both locales, at parity.

| Key | en | es |
|---|---|---|
| `browser.saveOutcome.choice.keepOperation` | *Leave this as it is* | *Dejarlo como está* |
| `browser.rawEditor.diskLineEndingsNotPreserved` | *The version on disk uses carriage returns…* | *La versión del disco usa retornos de carro…* |
| `browser.matchCreation.revisionExpected` | *This snippet was **drafted** against version {revision}.* | *Este fragmento **se redactó** sobre la versión {revision}.* |

No key was removed. `browser.rawSave.choice.keepEditing` and
`browser.rawEditor.lineEndingsNotPreserved` are both still drawn — by the three authored-text
surfaces and by the editor's opening refusal respectively.

---

## 4. What no test can pin, and what one now can

### 4.1 The one the finding asked for

§10.1 said explicitly: *"Any fix must also add whatever the i18n suites cannot: nothing today would
fail if it were reverted."* That is true and was the whole reason a wording defect survived to a
window reading — the suites check key-set parity and placeholder agreement and never meaning.

**A verbatim-sentence assertion was considered and rejected.** Pinning
`es['browser.matchCreation.revisionExpected'] === 'Este fragmento se redactó sobre la versión
{revision}.'` only relocates the problem: it makes the dictionary immutable rather than correct, it
fails on every legitimate rewording, and — the decisive one — it would have passed just as happily
over the defective string had it been written a day earlier. It asserts *this is the value* and the
invariant is *this value does not claim a write*.

**What was added instead** is in `src/lib/i18n/dictionaries.test.ts`, three cases:

1. **The family is complete.** The six `*.revisionExpected` keys listed there must be **exactly**
   the set of dictionary keys ending in `.revisionExpected`, so a seventh write surface cannot join
   the dictionary without joining the check.
2. **None of the six, in either locale, uses a verb of writing.** `written`, `wrote`, `writes`,
   `saved`; `escrito`, `escrita`, `escribió`, `escribe`, `guardado`, `guardó`. The reason is stated
   in the suite: the same panel says *nothing was written* a few lines above.
3. **The word list is capable of firing.** Each locale's list must match something in that locale's
   own `browser.saveOutcome.nothingWasWritten`. A list typo'd into matching nothing would make case
   2 pass for a reason that has nothing to do with the dictionary.

Reverting the Spanish string fails case 2 (retake §5.1). **What it still cannot say**: whether
*redactó* or *drafted* is the right word, whether either is grammatical, or whether `es.json` is in
Spanish at all — the same honest limit the file's own header states for the identity heuristic. That
needs a bilingual reader, and claiming otherwise would be the over-claimed oracle this project calls
R24.

### 4.2 The one that is still open, deliberately

**`conflictChoiceKey`'s two `keepEditing` labels could be re-worded to read identically and every
suite would stay green.** What `saveOutcome.test.ts` holds is that the two keys are **different**,
that each draft kind reaches its own, and that the `operationChoice` label contains no word from
*editing* / *editando* / *editar* — with the old label asserted to contain one, so the check is
falsifiable rather than vacuous. That is a word check, not a meaning check, and the suite says so.

### 4.3 The refusal arm named in §2.2

`rawSave.ts`'s `keepEditing` still says *Keep editing* on the three operation-choice surfaces'
**refused** arm. Recorded, not fixed, for the reasons in §2.2. It is a sentence no window reading in
this project has ever drawn.

> **CORRECTION, 2c-4a-3c-4.** Fixed, at the review's insistence — see the correction block in §2.2.
> The sentence above is now false in both halves: the label branches on the surface's draft kind
> (`rawSaveChoiceKey(choice, draftKind)`), and a window reading has drawn it, in both languages, on
> the duplicator, the mover, the deleter and the match editor (`2c-4a-3c-4-retake.md` §3). The
> honest form of what this section was reaching for is one sentence and it is still true: **the
> mounted suites had been driving this arm for three sub-phases and no window had, and a green suite
> is not a screen.** What that argues for is taking the reading, not leaving the label.

---

## 5. What the fixes broke, revealed or left open

1. **Nothing broke.** 47 test files and 1 464 tests pass, `svelte-check` is clean, the build is
   174 modules with no server build in the bundle, and the retake found every behaviour 3c-2 had
   recorded still behaving that way — the capability lists, the two `MoveReloadWarning` arms, the
   five confirmation lines, the `confirmReload`/`confirmReloadClosing` branch, the operation
   summaries, the disk-text arms and the two-step reload.
2. **One existing test asserted the defect and was corrected.** `saveOutcome.test.ts`'s *labels the
   confirmation by what the surface drafts* looped over `['keepEditing', 'copyDraft',
   'reloadDiskVersion']` asserting they were **draft-kind-neutral**. `keepEditing` is out of that
   list and has a case of its own. A test that encodes a finding is not a reason not to fix it, but
   it is a reason to say so out loud.
3. **A jsdom file that mounts nothing is a new category.** `CLAUDE.md` §6 says *"only the seven
   files that opt into jsdom by docblock render a Svelte component in an automated test"*.
   `reveal.test.ts` is the eighth docblock and renders **no** component: it opts in because
   `revealOutcome` takes `HTMLElement`s and calling it with a hand-made object cast to one would be
   testing the cast. The sentence in `CLAUDE.md` is still true as written — it says which files
   *render a component* — but a reader counting docblocks will now find eight.
4. **`2c-3c-3-window-reading.md` §10.2's Low closed as a side effect**, with window evidence
   (retake §5.3). Deliberate (§2.3, decision 3) rather than accidental.
5. **The `MatchMover` asymmetry is now load-bearing in a second place.** `reloadWarning !== null`
   rather than `awaitingReloadConfirmation` is read by `MatchMover.svelte` for the reveal cue as
   well as for the warning. If that field is ever joined by a boolean, both readers move.
6. **Nothing measured how the movement feels.** The reveal is instant by construction and every
   rectangle in the retake is at 1180 × 728. Whether the jump is disorienting, and what happens at
   other window sizes, are questions no transcript answers.
7. **The probe is still in the tree**, with three temporary additions of its own (retake §1). Its
   removal is the next step and will take the build from 174 modules back to 173.

---

## 6. The gates, and every count

```
npm test                 47 files, 1464 tests, all passing
npm run check            415 files, 0 errors, 0 warnings
npm run build            174 modules
cargo build --workspace  ok
cargo clippy --workspace --all-targets -- -D warnings   ok
cargo fmt --check        ok
cargo test -p espansoconfig   149 passed, 0 failed
```

**Every move from 3c-2's 46 / 1427 / 413 / 173.**

- **Test files 46 → 47.** One new file: `src/lib/components/reveal.test.ts`.
- **`svelte-check` files 413 → 415.** Two new files: `reveal.ts` and `reveal.test.ts`. It counts
  sources, not test cases.
- **Build modules 173 → 174.** One new **source** module, `src/lib/components/reveal.ts`;
  `reveal.test.ts` is not in the entry graph. This is the *"moved by exactly the number of new
  source modules"* shape `CLAUDE.md` §6 names and not the `resolve.conditions` regression — checked,
  not assumed: `rg -c "internal/server|async_hooks"` over the built bundle finds nothing. The 173 it
  moved from is itself 172 plus `src/probe.ts`, so deleting the probe returns it to 173.
- **Tests 1427 → 1464, +37**, and all thirty-seven are accounted for:

  | Where | + | What |
  |---|---|---|
  | `src/lib/components/reveal.test.ts` | 11 | the new module's own suite |
  | `src/lib/i18n/dictionaries.test.ts` | 3 | the §10.1 invariant (§4.1) |
  | `src/lib/browser/saveOutcome.test.ts` | 1 | the `keepEditing` branch |
  | `src/lib/components/RawEditor.test.ts` | 4 | the label kept, 2 reveal cases, the committed panel |
  | `src/lib/components/MatchEditor.test.ts` | 3 | the label kept, 2 reveal cases |
  | `src/lib/components/MatchCreator.test.ts` | 4 | the label kept, the §10.1 panel, 2 reveal cases |
  | `src/lib/components/MatchDeleter.test.ts` | 3 | the new label, 2 reveal cases |
  | `src/lib/components/MatchMover.test.ts` | 3 | the new label, 2 reveal cases |
  | `src/lib/components/MatchDuplicator.test.ts` | 3 | the new label, 2 reveal cases |
  | `scripts/lint/ipc-detail.test.ts` | **2** | **nothing was written there** |

  The last row is worth its own sentence, because a count that moves in a file nobody touched is
  exactly the shape that should be explained rather than shrugged at: that suite is
  `it.each(scannableFiles()…)` over every `.ts` and `.svelte` file under `src/`, so adding two `.ts`
  files adds two cases. It is a scanner over the tree, not a suite with opinions about this change.

---

## 7. What this hands the reviewer

1. **Five findings closed and one Observation moved with the High**, each with a transcript in
   `2c-4a-3c-3-retake.md` §3 and a verdict table at its §7. Sixteen launches, all reaching `--- end`
   with a zero-byte `probe.err`; fourteen wrote nothing at all and the two that wrote are the byte
   check's control.
2. **Three claims to check against the code rather than against this file**, because a decision
   record claiming a guarantee the code does not give is this project's worst defect class:
   - §4.1's three cases really do fail on the reverted string — the mutation is retake §5.1;
   - the six components really do bind **two** elements and run the effect — the mutations are
     retake §5.2, and `rg -F "bind:this={outcome" src/lib/components/` should find twelve;
   - `conflictChoiceKey`'s comment now argues **for** what the code does. It previously argued for
     what the code did wrong, which is how the defect survived a review round.
3. **One thing deliberately not fixed** and argued rather than omitted: `rawSave.ts`'s
   `keepEditing` on the refused arm (§2.2, §4.3). — **The reviewer took it, returned NOT READY over
   it, and was right; see the correction blocks in §2.2 and §4.3.** Arguing for an omission is
   better than hiding one and is not a substitute for fixing it.
4. **One count that moved in a file this step did not touch**, explained in §6.
5. **The harness is still in the tree.** `npm test`, `npm run check`, `npm run build`,
   `cargo build`, `cargo clippy`, `cargo fmt --check` and `cargo test -p espansoconfig` all pass
   with it there, which is the arrangement `2c-4a-3c-1-instrument.md` §5.3 asks not to be
   "simplified". Removing it is 3c-4.
