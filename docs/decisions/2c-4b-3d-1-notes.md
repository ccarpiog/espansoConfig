# Phase 2c-4b step 3d-1 — the four findings of the 3c-2 reading, applied

`docs/decisions/2c-4b-3c-2-window-reading.md` §11 returned one High, two Mediums, one Low and five
observations over the reapply path of six write surfaces. **This step applies the four findings, plus
one scope addition that is argued and priced in §3.6 rather than smuggled** — §11.1's evidence is
refusals only, and the reveal this step adds fires on the two success arms as well. It does not take a
window reading — that is 3d-2, and it is owed for every component touched below — and it does not
remove the probe harness, which is 3d-3's and is still in the tree (§9).

**Eleven dictionary keys — fourteen string values across the two languages, of which nine are §5's
Spanish register subset — one new model function, one new DOM function, five components and ten new
tests.** No Rust changed. No new source module was added, and the production bundle is still **176**
modules.

**Read §2.5, §3.5, §4.4 and §5.3 before quoting any of the fixes as proven.** Each fix is a sentence
or a viewport, and this repository has no executable test that can fail for either: the i18n suites
check key parity and placeholder agreement, never meaning, and neither a model test nor a mounted test
has a viewport. What the new tests pin is stated case by case, and what they cannot reach is stated
beside it rather than left to be assumed.

---

## 1. What changed, and where

| File | What changed |
|---|---|
| `src/lib/i18n/en.json` | 3 strings: `browser.notice.differentMatch` (`:123`), `browser.notice.gone` (`:124`), `browser.matchEditor.reapply.fieldCollisions` (`:255`) |
| `src/lib/i18n/es.json` | 11 strings: the same three, plus the nine of the register fix (§5) — `fieldCollisions` is in both sets |
| `src/lib/browser/selection.ts` | doc only — `reresolve`, `Reresolution`, the `clearSelection` arm's comment |
| `src/lib/browser/notices.ts` | doc only — the `differentMatch`, `gone`, `displacedByMove` and `displacedByDuplicate` arms |
| `src/lib/ipc/errors.ts` | doc only — `ReselectionOutcome`'s three arms |
| `src/lib/browser/workspace.svelte.ts` | doc only — four sites that described `differentMatch` as an identity |
| `src/lib/browser/reapply.ts` | **new**: `ReapplyReveal` and `reapplyReveal` (`:628`), whose JSDoc carries §3.6's argument and its price |
| `src/lib/components/reveal.ts` | **new**: `revealReapplyReport` (`:164`); `scrollQuietly` (`:73`) accepts `'nearest'`; `revealOutcome`'s (`:111`) and `scrollQuietly`'s JSDoc reworded by §10.1's sweep, and the file header by §11.1's, doc only |
| `src/lib/browser/saveOutcome.ts` | doc only, and by §11.1's sweep alone — `OutcomeReveal`'s five arms and `outcomeReveal`'s contract said *put its first line in view*, which is the sentence `reveal.test.ts:34` was paraphrasing |
| `MatchEditor`, `MatchCreator`, `MatchDeleter`, `MatchMover`, `MatchDuplicator` `.svelte` | one `$state` element, one `$effect`, one `bind:this` and one `reapply` class each; **and, by §11.1's sweep and doc only, the two outcome-panel comments every one of the six write surfaces carries** — `RawEditor.svelte` is in that set and in no other part of this step |
| `src/lib/browser/matchEditor.ts` | doc only — the `collision` verdict, `MatchReapplyPlan.collisions`, `EditorReapplyObstacle`'s `fieldCollisions` arm, `editorReapplyObstacleKey` |
| `reapply.test.ts`, `reveal.test.ts`, five mounted suites | **10 new cases**; one corrected comment in `notices.test.ts`; §10.1's sweep added the *a spy is a platform that always accepts* clause to `reveal.test.ts`'s block comment and to the five new mounted cases — comments only, no assertion changed and no case added |
| `saveOutcome.test.ts`, `RawEditor.test.ts`, and seven test files already in this table | **§11.1's sweep only**: **58** suite names, case names and comments across **nine** test files that said *puts … in view*, *brings … into view*, *scrolls … into view* or *reveals …*, all now written as requests. **No assertion changed and no case was added or removed**, which is why `npm test` stays at 1634 in 49 files |

**`RawEditor.svelte` draws no reapply report at all** — `beginReapply` answers `unavailable` for it
and no control calls it — so there is nothing on that surface for §11.1's repair to point at, and no
line of its behaviour changed. **Two of its comments did**, in §11.1's sweep, which reached every one
of the six write surfaces because the sentence it removed is on all six. It remains one of the six
surfaces 3d-2 must re-read, for §5's Spanish reason and now for `CLAUDE.md` §6's rule that a reading is
re-taken after any change to a component.

---

## 2. §11.3 — the two selection-notice sentences. **High**

### 2.1 What the predicate actually is

`reresolve` (`src/lib/browser/selection.ts:192`) reads `view.matches[previous.position]` and compares
`matchFingerprint`, which is `match.source_text` and nothing else (`:109`). So the three arms carry
three predicates and no more:

| Arm | Predicate |
|---|---|
| `sameMatch` | the held index holds an entry whose bytes are exactly the bytes that were selected |
| `differentMatch` | the held index holds *some* entry, and its bytes are not those bytes |
| `gone` | the held index holds **no entry** — a fact about the *length* of the list |

**`differentMatch` is byte inequality.** The same snippet edited in place by another program satisfies
it; so does a wholly different snippet moved into that index; and nothing in the code can tell those
two apart. Launches L43–L46 of the reading are the first case, and the window said *"what is now in
that position is a different snippet"* while the block two lines below said the reapply had identified
that same snippet by correspondence evidence.

### 2.2 What the sentences now claim

`browser.notice.differentMatch` (`en.json:123`) now says that what is in that position **is no longer
written the way the snippet you had selected was**, that it **may be the same snippet with changes in
it, or a different one**, and that **espansoConfig compares the text and cannot tell which**. Every
clause is a restatement of the predicate: a byte comparison, its two possible causes, and the
application's inability to choose between them. The selection is still cleared and the sentence still
says so, because the *rule* was never the defect — a positional-plus-bytes rule that refuses to guess
is the conservative one, and one that kept the selection on changed bytes would claim the identity
this sentence has just stopped claiming.

`browser.notice.gone` (`:124`) now says that **espansoConfig can no longer point at the snippet that
was selected**, and that **this is not a statement that it was removed** because **nothing here
searched this file for it**. It no longer says the file "no longer holds" the snippet, which a length
comparison cannot establish: an external deletion of an *earlier* snippet shortens the list, so a
selection held at the last index falls off the end while what it named is still in the file one index
lower.

Both Spanish twins carry the same clauses and are in the *tú* register the rest of the application
uses (§5).

### 2.3 The sweep's own finding: `gone` has **two** producers, not one

The finding cited `selection.ts:177-180` — `reresolve`'s out-of-range index. It is not the only
producer. `repairSelection`'s `clearSelection` arm (`selection.ts:292`) also answers
`reason: 'gone'`, and it is reached from `identityRecovery` for `identityNoSuchMatch`,
`identityWrongDocument` and `unknownDocument` (`src/lib/ipc/errors.ts:742-745`). On that path
**nothing was read at all** — `reloaded` is `null` by construction — so a sentence phrased as a claim
about the list's length would have been false there, and a wording that fixed the finding as written
would have introduced a narrower instance of the same defect on the arm the finding did not name.

The sentence shipped is therefore phrased about the **selection** — *this cannot be pointed at any
more* — which is exactly what both producers establish and all that either does. The two producers
are now named in the same sentence in `selection.ts`'s `clearSelection` comment and in `notices.ts`'s
`gone` arm.

### 2.4 What was deliberately **not** touched, and why it is written into the code

`browser.notice.displacedByMove` and `browser.notice.displacedByDuplicate` carry the identical
wording and the identical `differentMatch` outcome, and **their identity claim is earned**. Round 1 of
the 3c-2 fix round alleged the same defect there and round 2 of the review retracted it: the
attributed notices are reachable only when the projection just read is the committed operation's own
parse, guarded by `fresh.value.revision === moved.revision` in two structurally identical but
**separate** places — `adoptTheDocumentOnDisk` (`workspace.svelte.ts:2749-2751`) for the move and
`adoptAfterTheDuplicate` (`:2890-2892`) for the duplicate — and within that parse a move reorders the
same items without changing any item's bytes while a duplicate inserts a byte-exact clone. Both sites
were read before anything in this step was changed.

Because "a shared string is not a shared predicate" is the exact mistake that produced a retracted
High, both arms' doc comments in `notices.ts` now say so **in the code**, ending with *do not "fix"
this sentence to match `differentMatch`'s*. That is the only durable place for it: no test can carry
it.

### 2.5 What no test in this repository can falsify

- **Nothing pins what either sentence claims.** `notices.test.ts` checks that every notice has a key,
  that the keys are distinct, that each sentence has more than four words and ends with a full stop,
  and that the Spanish differs from the English. Reverting either string to its 3c-2 wording leaves
  every one of those green. The suite's own comment said the false thing — *one means the selection
  moved to something else, the other that it vanished* — and it now says what the two predicates are
  and that no test can fail for the difference.
- **`gone` has never been drawn on a screen.** The reading's §12.16 records it: no fixture pair
  shortened the snippet list past the held index, and the `clearSelection` producer was not provoked
  either. Both halves of this fix are source-derived for that arm.
- **`differentMatch` has ten launches behind its *old* wording and none behind the new one.** 3d-2 is
  what supplies that.

---

## 3. §11.1 — a refused reapply reported where nobody could see it. **Medium**

### 3.1 The mechanism, and where the repair went

The report is a second `role="status"` panel drawn immediately before the outcome panel in all five
match surfaces. The reveal machinery knew only about the outcome panel: `outcomeReveal`
(`src/lib/browser/saveOutcome.ts:1711`) enumerates five cues and has no arm for a report, and
`revealOutcome` (`src/lib/components/reveal.ts:111`) is handed only `outcomePanel` and
`outcomeChoices`. Nothing in the application pointed a viewport at the report, and in all 42
`manualResolution` launches of the reading it was drawn entirely above the visible band.

The repair is **one new cue and one new bound element**, and the decision is in the model, not in five
renderers (2c-3c-3's Medium):

- `reapplyReveal(code: ReapplyOutcomeCode | null): ReapplyReveal` in `src/lib/browser/reapply.ts:628`
  — `'none'` when no report is drawn, `'reportPanel'` for **every** arm, the two that succeed included
  (§3.6 is why, and what that costs). The switch is written out
  over all six arms rather than defaulted, so a seventh arm of `ReapplyOutcome` is a compile error
  here and whoever adds it decides whether their report is revealed.
- `revealReapplyReport(reveal, report)` in `src/lib/components/reveal.ts:164` — the DOM half, beside
  `revealOutcome` and sharing its `scrollQuietly` guard against a platform with no `scrollIntoView`
  and one whose `scrollIntoView` throws.
- Five components each gained a `let reapplyPanel = $state<HTMLElement | null>(null)`, an `$effect`
  that calls the pair, a `bind:this={reapplyPanel}` on the report block and a `reapply` class on it so
  the block can be told from the outcome panel, which carries the same class and the same role.

**Every arm is revealed, the two that succeed included.** A report is only ever drawn in answer to a
press, and the arm easiest to miss is the one that changes least on screen. Withholding the reveal
from `reapplied` would have made the cue a second, quieter copy of the rule about which arms replace
the session — a rule `attemptOfReapply` already owns.

### 3.2 Why `'nearest'` and not `'start'`

`'start'` is what the three outcome-panel cues use, and it is wrong here. Per the CSSOM-View rule for
`'nearest'`, an element already fully inside the scrollport is **not scrolled to at all**, and one
above the scrollport is aligned top-to-top — which is `'start'`'s behaviour for exactly the case the
reading measured (`y` between −53 and −104 against a band starting at 44). So `'nearest'` **asks for**
the minimum movement that would make the report visible, and `'start'` would additionally ask to move
a report that was already in view, which is movement bought for nothing. *Asks for*: what the platform
then does is §3.3.

### 3.3 §11.4's constraint: what this guarantees and what it does not

§11.4 is not a repair request; it is the acceptance constraint. On five of six surfaces the conflict
panel's own controls already begin below the fold at 1180 × 728, and a fix that revealed the report by
scrolling *further down*, or by changing the conflict cue's `block` alignment, would trade one
invisible sentence for another.

**What the fix guarantees unconditionally.** It changes no cue, no alignment and no target of
`outcomeReveal`; the conflict panel's own reveal is byte-for-byte what 2c-4a-3c-4 shipped. That is a
claim about this repository's source and it holds whatever the platform does.

**What it guarantees only conditionally, said in the same sentence as the condition.** *On a platform
that implements `Element.prototype.scrollIntoView` and honours the call* — and `scrollQuietly`
(`src/lib/components/reveal.ts:73`) requires neither, returning without scrolling when the method is
absent and swallowing the exception when the call throws — nothing scrolls while the report is already
fully visible, and the page moves by exactly the amount needed to show it when the report is above the
scrollport, which cannot push anything that was above the fold below it. **Where the
platform does neither, nothing moves, and no code path in this repository can tell that apart from a
scroll that worked**: both of `scrollQuietly`'s arms are silent by design, because the sentences are
already drawn and losing an outcome panel to a scroll error would be strictly worse. So there is no
visual postcondition here to rely on and no test that can force one; the review's round-1 High was
this record and that JSDoc claiming one, and both now state the condition where they state the claim.
3d-2 is what observes the honoured case on the shipped WKWebView.

**What it does not guarantee.** The report sits *above* the outcome panel, so revealing it moves that
panel and its controls **down** the viewport by the report's own height — 90 to 124 px in the
reading's geometry. Those controls were already below the fold before this fix existed, so nothing
that was reachable without scrolling has become unreachable; but the scroll distance to them grows by
the report's height, and this record does not claim otherwise. At the reading's measurements the
conflict panel's *first line* would land between y ≈ 141 and y ≈ 178 in a band of [44, 689], which is
in view — **that is an arithmetic prediction from 3c-2's numbers and not a measurement**, and §7 hands
it to 3d-2 as the first thing to check.

### 3.4 The second press

L107–L110 pressed the control again and got the identical sentence at the identical rectangle. The
cue this fix adds is a *string*, and a second refusal produces the same string, so an effect depending
on the cue alone would not re-run and the second press would still do nothing when the person had
scrolled away. Each component therefore reads `reapplyReport` **inside** the effect:

```ts
$effect(() => {
  revealReapplyReport(reapplyReveal(reapplyReport?.kind ?? null), reapplyPanel);
});
```

`reapplyReport` is `reapplyToShow(reapplyAttempt, session)`, and every transition in this repository
returns a **fresh** outcome object, so its identity changes on every press and the effect is
invalidated. **Nothing in Svelte or in TypeScript enforces that**: a maintainer who lifted the call
into a `$derived` cue and depended on that would silently restore the second-press defect, which is
why the call is written this way in all five files and why each one says so in a comment beside it.

**The two effects do not fight over the same scroller, and no type makes that so.** A refused reapply
leaves `view.outcome` exactly as it was, so `outcomeReveal`'s cue does not change and its effect does
not re-run; a successful one removes the outcome entirely, so its cue becomes `'none'`. That is an
implementation fact about five components, stated in `reveal.ts`'s header in the same sentence as what
the types do force.

### 3.5 What no test in this repository can falsify

- **Neither a model test nor a mounted test has a viewport.** vitest's default environment lays
  nothing out, and jsdom implements no layout and no `scrollIntoView` at all — `reveal.test.ts`'s
  first case asserts that absence against the platform. So **no test can fail because a block is off
  screen, and none can fail because a reveal put it somewhere useless.** A green suite is not a
  screen, and this finding is the proof: 1624 tests were green over the defect.
- What the ten new tests do pin: that `reapplyReveal` answers `'none'` for no report and
  `'reportPanel'` for each of the six arms (`reapply.test.ts`); that `revealReapplyReport` asks for
  `block: 'nearest'` on the element handed to it, does nothing for `'none'` or a null element, and
  does not throw when the platform refuses (`reveal.test.ts`); and that each of the five components
  **binds the block and runs the effect**, on the first press and again on the second
  (one case per mounted suite).
- The mounted cases were verified to fail without the fix: disabling the effect in
  `MatchDeleter.svelte` alone turned its case red on `expect(scrolled).toHaveLength(1)` (0 received),
  and the file was restored immediately afterwards.
- **Whether a `role="status"` block inserted whole is announced by a screen reader** is still
  unmeasured and still not what this severity rests on (the reading's §12.7).
- **A spy is a platform that always accepts.** Every case that *observes* a reveal installs
  `scrollIntoView` itself, so what it observes is a platform that never refuses. The two platforms
  `scrollQuietly` exists for are exercised — `reveal.test.ts`'s first case asserts jsdom's **absent**
  method against the platform, and two cases install a **throwing** one — but all three can assert
  only that nothing threw. **No case in this repository asserts that anything moved, and none can.**
  That sentence is now in `reveal.test.ts`'s block comment and in each of the five mounted cases,
  because it is the half of §3.3 a reader of a green suite would otherwise not meet.

### 3.6 The scope addition: the reveal is **not** restricted to the refusal arms

**What was widened.** `reapplyReveal` (`src/lib/browser/reapply.ts:628`) answers `'reportPanel'` for
all six arms of `ReapplyOutcomeCode`, `reapplied` and `alreadySatisfied` included, so all five match
surfaces run the reveal effect after a **successful** reapply too. §11.1's evidence is refusals only —
42 `manualResolution` launches — so this is more than the finding asked for, and the review's round-1
Low is right that the first version of this record hid that behind *"the four findings and nothing
else"*. That sentence is gone.

**Why it was kept rather than narrowed.** Restricting the cue to `manualResolution`, `adoptionRefused`,
`unavailable` and `notAttempted` would leave a report block nobody can see standing on the two arms
that succeed — the identical defect, in a different arm, reintroduced by the fix for it. The success
arms are also the ones easiest to miss, because they change least on screen. And the narrower rule
would restate, in a second place, which arms replace the session — a rule `attemptOfReapply` already
owns, and the kind of duplication 2c-3c-3's Medium is about. This project has a precedent directly on
point: at **2c-4a-3b** a step went past its brief and Codex round 1 **ruled the widening
justified**, on the ground that it was argued and its effect verified rather than smuggled. This is
that shape, and the argument is in `reapply.ts`'s own JSDoc as well as here.

**What it costs, and the direction is unknown rather than predicted.** *This paragraph is the review's
second round correcting its first: round 1 wrote that a success-path reveal pushes the deleter's
confirmation and the mover's destination list **down** by the report's height. The markup was then read
and says the opposite.* Both of those controls are drawn **before** the report, not after it —
`MatchDeleter.svelte`'s confirmation block at `:464` against its report panel at `:516`, and
`MatchMover.svelte`'s destination list at `:663`–`:703` against its report panel at `:779` — so **the
report's own height is not the quantity involved at all**, and nothing on this path pushes either
control down by it.

**And which way the page moves is not known either.** `'nearest'` has three answers and the choice
among them is made by where the rebuilt report is relative to the scrollport when the reveal fires: a
report **below** it is aligned bottom-to-bottom, which carries these earlier controls **up** and far
enough takes them off the top; a report **above** it is aligned top-to-top, which carries them
**down**; a report already fully inside is not scrolled to at all. **The success layout has never been
measured**, so which of the three happens is open. §11.1's 42 launches are refusals, and a refusal
leaves the outcome panel standing while a success removes it entirely; the refusal geometry (report at
`y ∈ {−53 … −104}`, outcome panel below it) therefore establishes nothing about the success one, in
either direction. Everything this record says about the refusal path in §3.3 stands, because there the
moved element — the outcome panel — really is *below* the report; everything about the success path is
a question for 3d-2 and is written as one.

**So the check is all five, not two.** The widening runs on both success arms in all five match
surfaces and its whole argument is that a success report must not go unseen, so §7 asks 3d-2 for the
success-arm report **and the next usable controls** on every one of them, in both languages. The
deleter's confirmation and the mover's destination list stay as those two surfaces' own additions —
they are the concrete controls to name there — but they were never the whole success-path surface, and
treating them as it left the editor, the creator and the duplicator with the widening unmeasured. If a
success report is unseen, or the controls after it are unreachable without scrolling, this addition is
what put it there and the narrower rule is the fallback.

**What it does not change.** No cue, alignment or target of `outcomeReveal`; no arm of
`ReapplyOutcome`; nothing about what any report says or what any control does. `reapplyReveal` is
written out over all six arms rather than defaulted, so a seventh arm is a compile error and whoever
adds it decides this again.

---

## 4. §11.5 — `fieldCollisions` gave a false reason for a correct refusal. **Medium, and the grade is kept**

### 4.1 What the predicate actually is

`fieldReapply` (`src/lib/browser/matchEditor.ts:1848`) answers `collision` when the retained intent is
not `'Unchanged'`, `sameBaselineState(was, now)` is false, and the new state does not already satisfy
the intent. `sameBaselineState` (`:1807`) compares **three** things — key presence, logical scalar
text, and eligibility — and the function's own contract table names *"newly ineligible"* as a
collision cause in as many words.

So a field whose **value on disk did not change at all** produces this refusal when the fresh
projection made it ineligible, and in the sharpest sub-case the disk holds **exactly the drafted
value** while being ineligible. Both are covered by model tests that predate this step:
`matchEditor.test.ts`'s *row 6 — a Set over a field that is newly ineligible collides* and *row 6 — a
Set whose value the disk matches, in a field it made read-only, collides*. The arms are reachable and
tested; only the sentence was wrong.

### 4.2 Which end was fixed, and the argument for choosing it

The finding offered both ends: narrow the predicate — split the ineligible arm into its own obstacle
beside `targetNotEditable` — or widen the sentence. **The sentence was widened**, for three reasons:

1. **The predicate is a genuine disjunction whose members are interchangeable at the point of use.**
   Any one collision refuses the whole reapply (consult Q4), and the recovery offered is identical for
   all three. Two obstacle codes would name one refusal and one recovery twice.
2. **A field can differ in value *and* in eligibility at once**, so a split needs a precedence rule,
   and a precedence rule is a claim about which difference *caused* the refusal that the predicate
   does not support — the defect being fixed, re-introduced one level down.
3. **`targetNotEditable` is a different predicate, not a wider one.** It is `matchEditability` over
   the whole identified snippet: *there is nowhere to put your changes at all*. A per-field
   eligibility change placed beside it would put two unlike predicates under one heading.

The sentence now reads: *The version on disk does not hold these fields the way the version your
draft was built on did — a different value, the key added or removed, or a change in whether this app
will edit it — so espansoConfig will not decide what to do with them: {fields}.* The em-dashed clause
is `sameBaselineState`'s three comparisons in order, the opening is `!sameBaselineState`, and *will
not decide what to do with them* is the refusal without the claim that there are two values to choose
between. The old sentence's *"so espansoConfig will not choose between them"* was the part that
invited a person to resolve a conflict of values that, in the sharpest sub-case, does not exist.

**The `collision` name stays and the code says why.** A refusal's sentence must be true of its
predicate, not of its name; renaming the verdict would touch the model, the obstacle union, the wire
of five test files and the plan, and buy no truth. Instead `FieldReapplyVerdict`'s `collision` arm,
`MatchReapplyPlan.collisions`, `EditorReapplyObstacle`'s `fieldCollisions` arm and
`editorReapplyObstacleKey` all now say, in the code, that the name is narrower than the predicate and
that the sentence is written against the predicate.

### 4.3 The grade: **Medium**, and it was re-examined rather than inherited

The review's round 1 graded this High; the reading argued it down to Medium on this project's own
precedents — 2c-4a-3c-2 §10.1 graded a false claim about *whether the file had been written* a High,
and §10.5 graded a refusal explained by a sentence about the wrong control a Low — and **round 2 of
the review adjudicated that rebuttal in the record's favour** (`docs/reviews/phase-2c-4b-3c-2-reading.md`,
round 2, *Clean*). This step re-examined it with the argument in view and **keeps Medium**: the
outcome sentence above it (*Nothing was written*) is correct, every branch that produces this sentence
is one of the transitions' early returns and so calls no command, the refusal itself is right, and
what was wrong is the *reason*. It sits above §10.5's Low because a wrong reason is actively
misdirecting rather than merely misplaced. No re-grade.

### 4.4 What no test in this repository can falsify

The i18n suites check that the key exists in both dictionaries and that `{fields}` appears in both.
**They cannot fail for what the sentence claims**, and reverting it to the 3c-2 wording leaves the
whole suite green. The model tests cited in §4.1 pin the *verdict* for the two ineligibility
sub-cases; they say nothing about the prose. And the reading's §12.15 stands: every launch that drew
this sentence staged a genuine value collision, so **no screen has ever shown this sentence over the
arm it was reworded for** — 3d-2 will not change that either, because the harness has no fixture that
makes a field ineligible.

---

## 5. §11.2 — the Spanish reapply family's register. **Low**

### 5.1 Nine strings, not seven, and how the count was re-derived

The finding said seven, from a whole-word search for *usted* over `es.json`. That search is right —
before this step it matched exactly seven lines, `browser.reapply.{ready,readyOperation,reapplied,
alreadySatisfied,manualResolution,adoptionRefused}` at `:140-145` and
`browser.matchEditor.reapply.fieldCollisions` at `:255`; the two `…Exhausted` lines at `:619` and
`:625` are substring false positives and are not user-facing register.

**The word is not the defect, though.** Sweeping the same family for *usted* verb and possessive forms
that do not spell the pronoun found two more:

- `browser.reapply.unavailable` (`:146`) — *lo que **tiene** aquí*, now *lo que **tienes** aquí*;
- `browser.matchEditor.reapply.targetNotEditable` (`:256`) — *dónde poner **sus** cambios*, now *dónde
  poner **tus** cambios*.

Nine strings changed. The remaining members of the family — `notAttempted`, the four
`browser.reapply.obstacle.*`, and the eight surface-specific obstacles at `:303-305`, `:332`,
`:374-376` and `:410` — are impersonal and needed nothing; each was read rather than assumed.

After the change, a whole-word search for *usted* over `es.json` matches **nothing**, and the 33 lines
carrying at least one of the reading's five *tú* markers are unchanged in number.

### 5.2 What changed inside the sentences

The verb forms, not the vocabulary: *que ha conservado* → *que has conservado*, *que pidió* → *que
pediste*, *envíelo cuando quiera* → *envíalo cuando quieras*, *se le dirá* → *se te dirá*, *hasta que
usted envíe algo* → *hasta que envíes algo*, *Puede seguir aquí* → *Puedes seguir aquí*. Every clause
the reading verified against Q6's list in §3 — *intentará aplicar*, *partiendo de ese documento recién
analizado*, *no se puede emparejar con seguridad*, *ya contenga … y no quede nada por enviar*, *puede
rechazarse, o … volver a entrar en conflicto* — is present and unaltered in substance. No English
string changed for this finding; English has no such distinction.

### 5.3 What no test in this repository can falsify

**Nothing.** This is the gap `CLAUDE.md` §6 names: the i18n suites check parity and placeholder
agreement, so nothing failed when these strings were written in *usted* and nothing would fail if they
were written that way again. The finding asked that whatever is added to stop it recurring be
something the suites cannot already do; **nothing was added**, deliberately. A keyword check for
*usted* would pass over `tiene`/`sus` — the two instances the finding's own search missed — and would
therefore give a false assurance in exactly the shape this project keeps re-finding. Register remains
a reader's judgement, and 3d-2 reads it on a screen in Spanish.

---

## 6. The sweeps, and what each one found

Written from what the corrected claim says, not from the words the findings used — the rule
`CLAUDE.md` §6 states twice and that 2c-4a-2 needed four review passes to learn.

| Sweep | Shape searched for | Found |
|---|---|---|
| §11.3 | any prose asserting that `differentMatch` means *another snippet*, or `gone` that the file no longer holds one | 6 sites: `notices.ts`, `selection.ts` (2), `ipc/errors.ts`, `workspace.svelte.ts` (4 comments), and **one test comment** in `notices.test.ts` |
| §11.3 | the second producer of the same notice | `repairSelection`'s `clearSelection` arm (§2.3) — not named by the finding |
| §11.5 | any prose saying the disk *changed* or *moved* a drafted field's value | 4 doc sites in `matchEditor.ts`; two *test names* left alone, because their fixtures really do stage a value change |
| §11.2 | *usted* register, not the word | 2 strings beyond the finding's seven (§5.1) |
| §11.1 | any other panel with no reveal cue | none — `revealOutcome` and `revealReapplyReport` between them now cover every `role="status"` block on the six surfaces |

**The test comment is the one worth naming.** `notices.test.ts`'s comment carried the exact claim the
High is about — *one means the selection moved to something else, the other that it vanished* — while
every assertion under it passed. That is the same place 2c-4a-3a's round 2 found its narrower
instance, and it is the reason this step's sweeps included `*.test.ts`.

---

## 7. What step 3d-2 must look at on a screen, per component

Every component below changed, so the reading is re-taken over each (`CLAUDE.md` §6: a window reading
is re-taken after **any** change to a component). Both languages, and the reading's own launch
discipline — one plan per launch, into a fresh bundle path.

**(f) is owed by all five match surfaces and not by two**, which is the second review round's
correction. §3.6's widening runs on both success arms of every one of them, and its whole argument is
that a success report must not go unseen — so a matrix that read the success path on the deleter and
the mover alone left the addition unmeasured on the editor, the creator and the duplicator, where the
argument applies identically. **(f), in both languages, on every row below that names it: stage a
*successful* reapply — not a refused one — and read (i) whether the report block itself is in the
visible band, and (ii) whether the controls a person would use next are still reachable.** The success
layout has never been measured and §3.6 no longer predicts anything about it: the controls named per
component are drawn **before** the report, so the report's height is not what moves them, and
`'nearest'` may scroll up, down or not at all depending on where the rebuilt report lands. **Record
which of the three happened**, not only whether the controls were reachable.

| Component | What 3d-2 must read |
|---|---|
| `MatchEditor.svelte` | (a) after a refused *Keep my draft*, the report block is **in the band** and no longer at `y ∈ {−53 … −104}`; (b) where the conflict panel's first line landed — §3.3 predicts ≈141–178 from arithmetic and this is the measurement; (c) a **second** press still scrolls, and the person can tell the two presses apart; (d) `fieldCollisions`' new sentence, read in full in both languages; (e) `differentMatch`'s new sentence on L43–L46's fixture pair, beside the reapply block that identifies the same snippet — the contradiction §11.3 opened is what must be gone; **(f)** — the next controls here are the editor's own fields and its *Save this snippet* row |
| `MatchCreator.svelte` | (a), (b), (c) as above; the creator's plan holds no selection, so it says nothing about (e); **(f)** — the next controls here are the form's fields and its save row |
| `MatchDeleter.svelte` | (a), (b), (c); **(f)**, and this surface's own control for it is the **renewed confirmation** at `MatchDeleter.svelte:464` — drawn *above* the report at `:516`, so the question is whether revealing the report has taken the confirmation off the **top** of the band, which is the opposite end from the one §3.3's refusal geometry is about |
| `MatchMover.svelte` | (a), (b), (c); **(f)**, and this surface's own control for it is the **rebuilt destination list** at `MatchMover.svelte:663`–`:703` — drawn *above* the report at `:779`, same question as the deleter's, and Spanish is the longer text of the two |
| `MatchDuplicator.svelte` | (a), (b), (c); **(f)** — the next control here is the duplicator's own action row; and the refusal/acknowledgement round of §6 of the reading, whose *Save anyway* was the one panel that needed no scrolling — it must still need none |
| `RawEditor.svelte` | **unchanged code**, read for two things only: that it still draws no reapply control and no readiness sentence, and the Spanish register of any reapply-family string that reaches it (none should). No (f): it draws no report at all |

Three things 3d-2 should read that this step deliberately did **not** change:

1. **The report block has no visual distinction from the outcome panel.** It gained a `reapply` class
   and no styling. If the reading finds that two identical panels stacked one above the other read as
   one, that is a new finding for 3d and not a regression of this one.
2. **Nothing moves focus into either panel** (§11.6). Unchanged, and still not filed as a defect.
3. **The Spanish editor and creator still wrap their four conflict choices onto two rows** (§4.1 of
   the reading). Layout, unchanged, and a reveal the platform honours pushes both rows further down,
   because those rows are inside the outcome panel and the outcome panel is drawn *below* the report.

---

## 8. What this step did not do

- **No window reading.** Everything in §3 about where anything lands on a screen is arithmetic over
  3c-2's numbers, or a claim about which function is called. 3d-2 is the measurement.
- **No harness removal.** `src/probe.ts`, `src-tauri/src/probe.rs` and the two hook lines each in
  `src/main.ts` and `src-tauri/src/main.rs` are all still in the tree, untouched by this step; 3d-3
  removes them.
- **No new obstacle code, no new notice arm, no new i18n key.** **Fourteen localized values across
  eleven keys** were reworded in place — three in English and eleven in Spanish, `fieldCollisions`
  being the one key in both sets (§1). **Nine** is the count of §5's Spanish *register* subset alone
  and is not the count for the step; §5.1's heading is about that subset and says so.
  `npm test`'s key-parity suites therefore say nothing new, which is the point of §4.4 and §5.3.
- **No change to `browser.notice.displacedByMove` or `browser.notice.displacedByDuplicate`** (§2.4),
  and **no change to the behaviour of `outcomeReveal`, `revealOutcome` or `scrollQuietly`, nor to the
  conflict panel's `block: 'start'` alignment** (§3.3). `revealOutcome`'s and `scrollQuietly`'s JSDoc
  *were* reworded — by the round-1 High's sweep, and doc-only (§10) — and `outcomeReveal`'s, its
  `OutcomeReveal` arms' and every component's outcome-effect comment by round 2's (§11.1), also
  doc-only. **No body of any of the three changed in either round.**
- **No fixture that makes a field ineligible.** §11.5's arm remains without a screen behind it, before
  and after this step.

---

## 9. The gates, with the harness still in the tree

| Command | Result |
|---|---|
| `npm test` | **1634** passed, 49 files — 1624 + the **10** cases this step added |
| `npm run check` | **419** files, 0 errors, 0 warnings — unmoved |
| `npm run build` | **176** modules — unmoved, and `rg 'svelte/internal/server' dist/assets/*.js` finds nothing |
| `cargo test --workspace` | **1086** passed, 0 failed — unmoved; no Rust changed |
| `cargo clippy --workspace --all-targets -- -D warnings` | clean |
| `cargo fmt --check` | clean |

The module count is unmoved because **no source module was added**: `reapplyReveal` went into an
existing `src/lib/browser/reapply.ts` and `revealReapplyReport` into an existing
`src/lib/components/reveal.ts`. That is the shape `CLAUDE.md` describes for a change that adds no
module, and it is the check rather than the number.

The ten new tests are: two in `src/lib/browser/reapply.test.ts`, three in
`src/lib/components/reveal.test.ts`, and one in each of the five components' mounted suites.

**Both review rounds re-ran all six gates and every number above is unchanged.** That is what a round
whose fixes are all prose should produce: **neither added a test**, because none of the five findings
is falsifiable by one — round 1's High is a contract's honesty, its first Low a recorded scope
decision, its second a count in this file; round 2's first Low is what a suite's names claim and its
second is a paragraph read off the wrong end of some markup. A round that changed only sentences and
moved a gate number would be a round that had done something else as well.

`git status --short --untracked-files=all` lists the four harness paths — `src/main.ts` and
`src-tauri/src/main.rs` modified by two hook lines each, `src/probe.ts` and `src-tauri/src/probe.rs`
untracked — beside this step's own modified files and this record. Nothing under
`crates/espansoconfig-core/tests/corpus/real/` appears, and no git command that changes anything was
run. **Neither review round ran any git command at all**; both confirmed the four harness paths by
reading the filesystem instead.

---

## 10. The first review round, and what it corrected

`docs/reviews/phase-2c-4b-3d-1.md` round 1 returned **NOT READY** on one High and two Lows. This
section is the record of that round, because **a fix is a change and the round that reviews it is not
optional** — and §11 is the proof of that rule rather than a formality: the confirmation pass found
this round's High still standing in test prose, and this round's own fix for its first Low describing
the markup backwards. **Read every claim below against §11 before quoting it**: the High is closed at
its contract sites and was not closed at its narrower ones until §11.1; §10.2's cost sentence is
retracted by §11.2; §10.3's counts stand as written and were re-confirmed.

### 10.1 The High: a contract claiming a guarantee the code does not give

This is `CLAUDE.md` §6's named worst defect class, produced by this step's own §3.3 and by
`revealReapplyReport`'s JSDoc. Both said the page *moves by exactly the amount needed* when the report
is above the scrollport. `scrollQuietly` (`src/lib/components/reveal.ts:73`) **returns without
scrolling when `scrollIntoView` is absent** and **swallows the call's refusal when it throws**, so the
movement is conditional on a platform honouring the call and no code or test here can force it.

**Fixed at the honest end, not by removing the guard.** The early return and the `catch` both stay:
`revealOutcome` has relied on them since 2c-4a-3c, jsdom has neither layout nor `scrollIntoView`, and
an outcome panel must not be lost to a scroll error. What changed is that **the condition is now in
the same sentence as the claim** — in §3.3, in `revealReapplyReport`'s JSDoc, and in the vocabulary of
all three of `reveal.ts`'s function contracts, which now say what is *asked for* rather than where
anything landed. That leaves the JSDoc's existing sentence — *only 3d-2's window reading can say where
anything landed* — agreeing with the paragraph above it instead of contradicting it.

**The sweep, written from the shape and not from the wording** (the rule 2c-4a-2 needed four passes to
learn, restated in §6):

| Shape searched for | Found, and what happened |
|---|---|
| a visual postcondition stated as unconditional, anywhere in `reveal.ts` | 3 sites, all reworded: `scrollQuietly`'s summary (*Scrolls one element into view* → *Asks the platform to…*, plus the two silences and their consequence), `revealOutcome`'s (*Brings…* → *Asks for…*, *put the panel's first line* → *ask for*, plus a new *asked for, not achieved* paragraph), `revealReapplyReport`'s (the finding's own site) |
| the same in the record | 2 sites: §3.3 and §3.2's *"is the minimum movement that makes the report visible"* |
| the same in **test comments and test names** | `reveal.test.ts`'s block comment gained *a spy is a platform that always accepts*; the five mounted cases gained the same clause. ~~**The reveal cases' *names* were left as they are, deliberately** — each names the case's intent, each has a block directly under it disclaiming the postcondition, and most of them are 2c-4a-3c's, so renaming them would be a second unargued widening of this step~~ **Overruled by §11.1.** The names were the surviving instance: a disclaimer under a case does not repair the sentence that names it, and *puts … in view* is the same unconditional postcondition the row above this one removed from the contracts. Every one of them is now written as a request |
| the same in the five `.svelte` effect comments | none — they describe what nothing pointed a viewport at before the effect existed, and claim no postcondition. **Correct about the *reapply* effect and wrong about the file**: §11.1 found the *outcome* effect's comment on all six write surfaces saying **The outcome panel is scrolled into view when it appears** |
| the same in `reapply.ts` | 1 site, in the `ReapplyReveal` type: *bring the block itself into view* → *ask for the block itself to be brought into view*. **Two more in the same file**, found by §11.1: the type's own summary and `reapplyReveal`'s |
| the same in `saveOutcome.ts` | **not searched, and it held five** — §11.1 |

**What the fix itself newly claims**, checked in the round's own spirit: §3.3 now asserts an
*unconditional* half — that no cue, alignment or target of `outcomeReveal` changed. That is a claim
about this repository's source, not about a viewport, and it is true: `revealOutcome`'s and
`scrollQuietly`'s **bodies** are untouched and only their JSDoc was reworded. §8's bullet was
corrected to say exactly that, because as written it would have become false.

### 10.2 The first Low: the widening, now argued rather than denied

§3.6 is new and is the answer: the widening **stays**, because restricting the cue to the refusal arms
leaves the identical unseen-report defect on the success arms, and this project ruled the same shape
justified at 2c-4a-3b when it was argued and its effect verified. What was wrong was the record's
*"applies the four findings and nothing else"*, which is gone from §1. The addition's price is named
in §3.6, in `reapplyReveal`'s JSDoc, and as an explicit **(f)** in §7.

**The price this round named was wrong, and §11.2 is the correction.** It said a success-path reveal
pushes the deleter's confirmation and the mover's destination list **down** by the report's height;
both are drawn *before* the report, so the report's height is not the quantity involved at all. And
**(f) was assigned to two surfaces when the widening runs on five** — §7 now defines it once and names
it on every match row. The widening itself stands; only what it costs and where that is measured
changed.

### 10.3 The second Low: the count, re-derived rather than patched

Both numbers were re-derived from the dictionaries themselves rather than from either figure in the
record — no git was run, so the derivation is: `docs/decisions/2c-4b-3c-2-window-reading.md` §11.3 and
§11.5 quote the **pre-change** wording of all three English strings, and each differs from what
`en.json` holds now; the Spanish register
set is `es.json`'s seven whole-word *usted* lines named in §11.2 plus §5.1's two, and a whole-word
search for *usted* over `es.json` now matches **nothing** while the two `…Exhausted` substring hits at
`:619` and `:625` remain and are not register.

- **English: 3** values — `browser.notice.differentMatch`, `browser.notice.gone`,
  `browser.matchEditor.reapply.fieldCollisions`.
- **Spanish: 11** values — those same three, plus §5's nine register strings, of which
  `fieldCollisions` is one; 3 + 9 − 1 = 11.
- **14 values over 11 distinct keys.** §1's inventory was right; §8's *"nine strings"* was §5's
  register-only subset used as though it were the step's total, and is corrected.

Nothing else in the record's inventory moved.

---

## 11. The second review round, and what it corrected

`docs/reviews/phase-2c-4b-3d-1-confirmation.md` returned **NOT READY** on two Lows: §10's High had
survived in test prose, and §10.2's fix had introduced a false claim about the markup. Both are prose,
**no behaviour changed in this round**, and no test was added or removed — the numbers in §9 are
unmoved for the second consecutive round.

### 11.1 The first Low: the movement claim, swept a fourth time

**This is the fourth time in this project that a closed finding survived in a narrower instance because
the sweep was written from the previous wording**, and §10.1's own sweep table is where it happened:
that table searched `reveal.ts`, the record, `reapply.ts` and the five `.svelte` *reapply* effect
comments, and it explicitly argued for leaving the reveal cases' **names** alone. The argument was that
each case has a disclaimer directly under it. **A disclaimer under a case does not repair the sentence
that names it** — a name is what a reader of a green suite sees first, and `puts the panel's first line
in view` is the identical unconditional postcondition the round had just removed from three contracts.
§10.1's row is struck through and overruled rather than deleted, because the reasoning is the exhibit.

**The shape searched this time**: any prose anywhere claiming that something *ends up* visible, at the
top, in view, or on screen as a result of a call — not the words *puts*, *brings* or *scrolls*, which is
how the previous sweep missed everything below.

| Where | Found | What it is now |
|---|---|---|
| `src/lib/components/reveal.test.ts` | 4 — the `PANEL_CUES` comment (*all mean put the panel's first line at the top*), two case names (*puts … in view*), and *asks for the minimum scroll that shows the report* | requests, and *would show* rather than *shows* |
| the five match mounted suites | 8 each — the suite name, its closing comment, four case names, the reapply case's closing comment, and the *never brought into view* comment | requests |
| `src/lib/components/RawEditor.test.ts` | 7 — the same set, minus the reapply case it does not have, plus *brings a committed save's panel into view too* | requests |
| `src/lib/browser/saveOutcome.test.ts` | 5 — the cue suite's name and closing comment, and three case names beginning *reveals* | requests |
| `src/lib/browser/reapply.test.ts` | 2 — *what a panel must bring into view*, opening and closing. Its case names were already requests | requests |
| `src/lib/browser/saveOutcome.ts` | **9, and this file was never searched in round 1** — the `OutcomeReveal` summary, all five of its arms (four saying *put its first line in view*, one *nothing is scrolled*), `outcomeReveal`'s own summary, *the three panel values scroll identically*, and the counterfactual about what framing the controls *would put on screen* | requests |
| `src/lib/browser/reapply.ts` | 2 more beside round 1's one — the `ReapplyReveal` summary and `reapplyReveal`'s | requests |
| `src/lib/components/reveal.ts` | 1 — the file header, *Bringing a save's outcome panel into view when it appears* | *Asking … to be brought into view* |
| the six `.svelte` write surfaces | 2 each — *so it can be brought into view* on the bound element, and the bolded **The outcome panel is scrolled into view when it appears** | *so a reveal has something to point at*, and *the outcome panel's appearance asks for a scroll into view* |

**82 sentences over 18 files, every one of them prose** — 4 + 40 + 7 + 5 + 2 + 9 + 2 + 1 + 12, in the
table's own order. `RawEditor.svelte` is in that set, which is why §1's *"`RawEditor.svelte` is
untouched"* is corrected there rather than left standing.

**Correction, and it is this section's own defect class turned on itself.** The paragraph above
originally went on to say that the reapply prose had been rewritten to requests and that all 82
sentences now make only request claims. **That was too broad, and a fifth review round
(`docs/reviews/phase-2c-4b-3d-1-final.md`) found three sites it had walked past** — all three using
*revealed* as an achieved postcondition, and all three in files the sweep had already visited and
counted:

| Where | What it said | What it says now |
|---|---|---|
| `src/lib/browser/reapply.ts` `ReapplyReveal` contract | *Every arm is revealed* | *Every arm asks for its report to be brought into view* |
| `src/lib/browser/reapply.ts` exhaustive-switch comment | whoever adds a seventh arm decides whether their report *is revealed* | … whether their report *is asked for* |
| `src/lib/browser/reapply.test.ts:421` closing comment | *End of the "every arm is revealed" case* | named for the case, whose own name at `:406` was already a request |

Running the synonym itself as a search — `revealed|ends up visible|will be visible|becomes visible`
over `src/` — then found a **fourth** the review had not named: `src/lib/browser/reapply.test.ts:409`,
the test file's own copy of the exhaustive-switch comment, fixed with it.

The count is therefore **86 sentences over the same 18 files**, and the honest statement of what the
sweep achieved is narrower than the one it made: it searched for a shape and it still missed a synonym
it had not enumerated, twice over.

**Two instances of the word are judged and deliberately left**, so a later sweep does not read their
survival as an oversight: `src/lib/components/reveal.ts:23` (*decided from save-model state what had to
be revealed*) and `src/lib/browser/saveOutcome.ts:1700` (*which thing must be revealed*). Both use the
word for **which panel the cue designates**, not for a movement that was achieved — the first inside a
historical account of where `outcomeReveal` used to live. Neither sits next to a claim about what a
person sees. That is a judgement about two sentences, not a rule, and it is recorded here so it can be
overturned rather than rediscovered.

**Nothing here says a later sweep will not find a seventh instance** — five consecutive rounds of this
step each closed a finding and left a narrower one standing, and the only thing that has ever caught
one is another round.

**What this round newly claims, checked in its own spirit.** The renamed cases assert less than the old
names did, so no test's meaning widened; and `saveOutcome.ts`'s arm comments now describe a request,
which is what `revealOutcome` does with them. **No suite, case or assertion was added, removed or
re-ordered**, so §9's 1634 in 49 files is the check on that and it holds.

### 11.2 The second Low: the success-path cost, read off the markup instead of predicted

§10.2's fix wrote that a success-path reveal pushes *the deleter's renewed confirmation and the mover's
rebuilt destinations* **down** by the report's height. **The markup says the opposite, and it was read
rather than assumed this time**: `MatchDeleter.svelte`'s confirmation block is at `:464` and its report
panel at `:516`; `MatchMover.svelte`'s destination list is at `:663`–`:703` and its report panel at
`:779`. Both controls are drawn **before** the report, so the report's height is not what moves them
and the direction is whatever `'nearest'` chooses from the unmeasured success layout.

That is the same defect class §10.1 is about — a record claiming something the code does not do — and it
was produced by the fix for the round that named that class. **A fix is a change, and the round that
reviews it is not optional**; this is the second consecutive round of this step to close a finding its
own predecessor's fix opened.

The correction is in three places, and it says *unknown* rather than substituting the opposite
prediction:

- `reapplyReveal`'s JSDoc (`src/lib/browser/reapply.ts`) — the controls' actual order, with file and
  line for both, and that `'nearest'` may scroll either way because **the success layout has never been
  measured**. 3c-2's geometry is 42 *refusal* launches, and a refusal leaves the outcome panel standing
  where a success removes it, so it establishes nothing about the success path in either direction.
- §3.6's cost paragraph, which now carries the retraction of round 1's sentence in the paragraph that
  replaces it.
- §7, whose matrix gave Editor, Creator and Duplicator refusal-path checks only. **The widening runs on
  both success arms in all five match components**, so (f) is now defined once above the table and named
  on all five rows: the success-arm report **and the next usable controls**, in both languages. The
  deleter's confirmation and the mover's destination list stay as those surfaces' own named controls —
  they are real, and they were never the whole success-path surface.

### 11.3 What no test in this repository can falsify, again

**Nothing in this round.** Every change is a sentence, and `CLAUDE.md` §6's gap is exactly this: the
i18n suites check parity and placeholders, and a test name is not asserted by anything. Reverting all
82 leaves 1634 tests green, `npm run check` at 0 errors and the bundle at 176 modules — which is what
§9's table shows and why it did not move.
