# Phase 2c-3c-3 — decision record

**The component and the evidence, and with them the whole of 2c-3c.** `MatchDuplicator.svelte`
draws the panel, `DetailPane.svelte` opens it and supplies the boolean step 2 deliberately left
without a producer, `MatchDuplicator.test.ts` mounts it, and
`docs/decisions/2c-3c-3-window-reading.md` is what a screen actually did. All three kinds of
evidence `docs/decisions/2c-split-notes.md` §7 requires now exist for this sub-phase: model tests,
a mounted-component test and a bilingual window reading.

The authority for the decisions below is `docs/reviews/phase-2c-3c-design.md` — its Q4, Q6, Q7 and
Q8. Where this record and that document disagree, the consult is right and this is a bug; where a
fix in §6 falsifies a sentence in §§1–5, §6 is the correction and §§1–5 are left as they were
written.

---

## 1. What this step built

| File | What it is |
|---|---|
| `src/lib/components/MatchDuplicator.svelte` | **new** — the panel: the sixth write surface, and a walk over `matchDuplicationView`'s answer. One `$derived.by` reads the projections; the acknowledge-and-retry round trip, the three outcome arms, the one recovery choice and the sticky action row are the whole of it |
| `src/lib/components/MatchDuplicator.test.ts` | **new** — 13 mounted cases over real DOM events, in two suites; the seventh file in this repository to opt into jsdom, by its docblock and by nothing else. The last suite drives a **real** `BrowserState` |
| `src/lib/browser/matchDuplication.ts` | `documentHasUnsavedDraft(document, drafts)` — the producer `duplicationEligibility`'s third argument never had; `MatchDuplicationView.notDuplicable` replaced by the presentation-ready `notDuplicableToShow`, computed by a new private `notDuplicableToShow()` from the same refusal answer that drives `canDuplicate`; the header's open-versus-dirty and testability paragraphs |
| `src/lib/browser/matchDuplication.test.ts` | 34 → **38** cases: two for the new producer, two for the suppression rule and its non-vacuous live half |
| `src/lib/components/DetailPane.svelte` | `MatchDuplicatingSession`, the `duplicatingMatch` state, the opener, the `{:else if}` branch that mounts the panel, `openMatchDrafts()` and `unsavedDraftInDocument()`; `busy` grown to six surfaces; the file header's testability paragraph corrected |
| `src/lib/components/DetailPane.test.ts` | one new case — that a person can reach the panel at all, over the selected snippet, with the pane's own producer answering; both fixtures given `path: matchListPath(0)` so they are genuine sequence items |
| `src/lib/i18n/{en,es}.json` | **one key rewritten per language** — `browser.matchDuplication.refused.unsavedDraftInDocument`. No key added, no key removed: 699 per language, at parity |
| `docs/decisions/2c-3c-2-notes.md`, `docs/reviews/phase-2c-3c-design.md` | correction blocks appended where each claims dirty-draft coordination (§2.3 below) |
| `docs/decisions/2c-3c-3-window-reading.md` | **new** — the reading: 24 launches, seven items, PASS on all seven |

**Nothing under `crates/espansoconfig-core/`, `src-tauri/` or `src/lib/ipc/` changed at all**, and
no corpus fixture's bytes changed. The primitive is 2c-3c-1's and the command and wrapper are
2c-3c-2's; this step is strictly above both.

---

## 2. The decisions

### 2.1 D1 — the component is a walk, and the one synchronous read is the component's job

`MatchDuplicator.svelte` holds no rule. The panel's whole state is
`session = $state.raw(startMatchDuplication(projection, match, unsavedDraftInDocument()))` plus one
`$derived.by` named `current`, whose body calls `projections()` **once** and returns both the array
it read and `matchDuplicationView(session, views)` derived from it. `runDuplicate` then takes the
identity it hands `beginDuplicate` out of that same value —
`identityInProjection(current.views, session.match)`, never `session.match`, whose freshness is a
claim the session makes about itself.

**That closes `2c-3c-2-notes.md` §4 hole 2 in the reading a reviewer can check**, and the two halves
are worth separating because they are enforced by different things:

- the **view and the submission identity** come from one read, in one `$derived.by` body, because
  they are the two answers that must describe the same parse at the moment of the click;
- the **eligibility** does not come from that read and is not meant to. It is frozen at
  `startMatchDuplication` from a `DocumentView` and a `MatchView` that `DetailPane` captures in
  **one assignment** (`duplicatingMatch = { projection: parse, match: target, file: inFile }`), which
  is 2c-2-2's High one level up: a projection and a snippet taken from two reads type-check
  perfectly and can describe two parses. The frozen verdict going stale is exactly what §2.2 is
  about.

**What nothing in TypeScript forces, in the same sentence as what it does force**: the `projections`
prop is a *function* so that a captured array cannot silently become a snapshot, but nothing stops a
caller passing a function that answers a stale array, and nothing in `matchDuplication.ts` can see
where its argument came from. The module header and the component's own note both say so.

### 2.2 D2 — the precedence between two refusals belongs to the model, not to a renderer

**Round 1's Medium.** `matchDuplicationView` handed out the frozen `notDuplicable` reason
unconditionally, and the only thing keeping it off the screen beside a live `outOfDate` was a
condition in `MatchDuplicator.svelte`'s markup. `refusalGiven` already ranked `outOfDate` above
`notDuplicable`; the view undid that ranking by exposing the suppressed reason through a second
field.

**The fix is a new field and a rule written where a model test can drive it.**
`MatchDuplicationView.notDuplicable` is gone; `notDuplicableToShow` is the presentation-ready
answer, and the private function that computes it returns the session's frozen reason **only when
`cannotDuplicate === 'notDuplicable'`** — that is, only when the frozen verdict is the refusal that
won — and `null` otherwise. **It is written against `'notDuplicable'` rather than against
`outOfDate`** on purpose: any refusal added above it in `refusalGiven`'s order suppresses the frozen
detail **by construction** rather than by a later edit in that function. The component's remaining
condition is a null check, and the comment beside it says so.

**The fact itself is not lost.** The unsuppressed verdict stays on
`MatchDuplicationSession.eligibility`, unchanged, for a caller that wants the fact rather than the
sentence; only what a screen is handed is gated. Both halves are tested from both sides —
`matchDuplication.test.ts` asserts the live case (the frozen reason **is** presented, so the
suppression case is not vacuous), the reprojected case and the flag-borne `outOfDate` that
`duplicationRecoveryFailed` produces without replacing a projection.

**Why this is architectural rather than cosmetic**, stated the accurate way: a rule written into one
renderer is a rule that renderer's own mounted suite has to carry alone, and a second renderer — or
a harmless-looking refactor of the first — can omit it while walking the model faithfully. The two
mounted cases that drove the old condition are kept as **this renderer's** regression cover; what
moved to the model is the decision every renderer now inherits.

### 2.3 D3 — R36 is kept, and only the claim was corrected

**Round 1's Low.** `documentHasUnsavedDraft` does not measure unsaved edits. It measures whether
this window has a **match editor open** over any snippet of the file, and it returns `true` for a
pristine editor whose buffers still equal its baseline. The sentence the refusal rendered said the
snippet *has edits that have not been saved* — false of exactly that case, and a sentence is data no
test can fail.

**The predicate is right and was not changed.** `isDirty` is derived inside `MatchEditor.svelte`'s
own session (`let session = $state.raw(startMatchEditor(...))`, line 230); `DetailPane` holds only
`{ match, file }` for an open editor and cannot see it. That is R36, and the trade is asymmetric:
over-refusing costs a person one closed editor, under-refusing strands their edits. So the
conservative predicate stays and **the sentence was rewritten to be true of it**, in both languages.
The English now reads, verbatim:

> A snippet in this file is open in the editor, and this app cannot tell whether it has been edited.
> Duplicating writes the file and gives every snippet in it a new identity, which would leave
> anything unsaved with nothing to be saved to — so close the editor first, saving or discarding
> what is in it. This is how this app works, not something the file refuses.

**The Spanish was written natively to the same claim, not translated word for word**: it opens with
the fact, disclaims the knowledge (*"esta aplicación no puede saber si se ha modificado"*) and
carries the conditional through the consequence with a subjunctive (*"lo que no se haya guardado se
quedaría sin ningún sitio donde guardarse"*). The window reading judged it natural Spanish and
confirmed it never asserts that unsaved edits exist (`2c-3c-3-window-reading.md` §4).

**"Document-wide dirty-draft coordination" is not what shipped, and the name is broader than the
fact on purpose.** The `unsavedDraftInDocument` arm keeps its name because the *risk* it names is
the unsaved edits such an editor may hold; what is measured is the open editor. Round 2's second Low
was that two governing records still listed the dirty-draft version as a completion criterion, so
**correction blocks were appended** to `docs/decisions/2c-3c-2-notes.md` §2.4 and to
`docs/reviews/phase-2c-3c-design.md` (Q6 and the completion criteria) rather than rewriting either —
the standing rule that a record is corrected in place and not edited into agreement with what
shipped.

**Only the file is compared, and that is the point.** A draft minted over an *earlier* parse of the
same file is stranded by a commit exactly as a current one is, so comparing whole identities would
let the very draft this rule protects slip through — the hole `moveEligibility`'s narrower rule
records, designed out by asking a wider question (consult Q6). A model case pins it.

**What the predicate does not cover, in the same sentence as what it does**: a whole-document raw
draft is not a match draft and is not counted, which is safe **only** while `busy` keeps the raw
editor and the duplicate panel mutually exclusive; and nothing in TypeScript can check that a caller
passes every editor it holds open — the argument being required is what stops silence compiling into
"there are none".

### 2.4 D4 — the testability claim was false as written, and the sweep included a pre-existing one

**Round 2's first Low, and it was introduced by round 1's own fix.** The fix's new prose said that a
decision in markup is something "nothing can check" and that no automated test in this repository
can drive `MatchDuplicator.svelte`. `MatchDuplicator.test.ts` opts into jsdom, mounts that panel,
and its live/stale pair is precisely what drove the old markup condition. A later maintainer
following that comment could have discarded real regression coverage on a premise the repository
disproves.

**The accurate claim, which is narrower and is what every touched site now says**: a **model** test
drives values and never markup, so a rule written into one renderer is carried by that renderer's
mounted suite **alone**, and a second renderer can omit it while walking the model faithfully. That,
not untestability, is the architectural problem.

**The sweep reached one absolute this step did not write.** `DetailPane.svelte`'s file header still
said "Nothing in this repository renders a Svelte component in an automated test, so logic put here
is logic nothing can check" — false of that very file, since `DetailPane.test.ts:1` opts into jsdom
and mounts the pane at line 181. The orchestrator corrected it directly rather than leaving a known
false absolute in place because it predated the step; the header now gives the narrow reason.

### 2.5 D5 — the window reading is the verdict, and this record does not restate it

`docs/decisions/2c-3c-3-window-reading.md` is the evidence: **24 launches**, each with its own
bundle path, `XDG_CONFIG_HOME` and `HOME`, all 24 reaching `--- end` with zero-byte `probe.err`, the
language set explicitly through the picker every time (`2c-2-2-window-reading.md` §1.2's lesson
applied rather than re-learned), 13 in Spanish and 11 in English. **PASS on all seven items, no High
and no Medium**, two Lows and three Observations, and **no defect in what is written to disk** —
every launch's tree compared whole against a pristine copy, with the clone checked byte-for-byte
against the bytes immediately preceding it.

Three things about that record are load-bearing here rather than decorative. **Eleven launches are
canned and five of those still wrote the file for real**; every number taken from one says it is
canned, in the same sentence. **The wire could not be canned at all** — in this WKWebView
`window.__TAURI_INTERNALS__` is a non-configurable property whose `invoke` is read-only, which is
what settled the canned route as a mounted component over a real projection. And **§12 is an
explicit list of nine things the evidence is not**; §4 below carries it forward rather than letting
it live only there.

---

## 3. Verification

Every command was run by the orchestrator, each as its own invocation.

- `npm test` — **1324 passed, 46 files** (from 1302 over 45).
- `npm run check` — 411 files, **0 errors, 0 warnings**.
- `npm run build` — **171 modules** (from 169).
- `cargo test --workspace` — **1046 passed, 0 failed**, unchanged: this step touched no Rust.
- `cargo clippy --workspace --all-targets -- -D warnings` — clean.
- `cargo fmt --check` — clean.
- `cargo tree -p espansoconfig-core | rg tauri` — no match (the D2x check).
- `cargo test -p espansoconfig-core --test corpus_integrity` — 17 passed.
- `git status --short --untracked-files=all` — no path under `tests/corpus/real/`.

**The module guard moved 169 → 171 and the delta is exactly the new-module shape**: one `.svelte`
file contributes its module **and** its scoped-style virtual module, which is the +4-for-two-files
arithmetic 2c-3a-2 measured. No `svelte/internal/server` and no `node:async_hooks` in the bundle, so
this is not the `resolve.conditions` regression. `vite.config.ts` was not touched.

**The test delta was derived rather than asserted, and it reconciles exactly.** +22 = 13
(`MatchDuplicator.test.ts`, measured by running it alone) + 4 (`matchDuplication.test.ts`, 34 → 38)
+ 1 (`DetailPane.test.ts`) + 4 generated: `scripts/lint/ipc-detail.test.ts` emits one case per `.ts`
or `.svelte` file under `src/` and gains **two** (the component and its test file), while
`scripts/lint/hardcoded-strings.test.ts` and `scripts/lint/built-translation-keys.test.ts` each emit
one case per `.svelte` file and gain **one** apiece. 1302 + 22 = 1324.

**The dictionaries were counted, not taken from a record**: 699 keys per language, identical key
sets, identical order. The `browser.matchDuplication.*` namespace is unchanged at 31 keys per
language — this step rewrote one sentence and added none.

---

## 4. Holes this step leaves open, each with its reason

**From the window reading's own §12, carried here rather than left in one file:**

1. **The wire could not be canned at all**, so no launch exercised `BrowserState.duplicateMatch`'s
   own failure handling from a window — the `mayHaveWritten` branch that forgets the text cache and
   re-reads has **model-suite evidence only**. The instrument was tried twice (L05, L05b) and WebKit
   refused both.
2. **In all eleven canned launches the `DetailPane` wiring and `BrowserState.duplicateMatch` were
   not on the path.** The panel is the real component over a real projection; the coordinator and
   the wrapper rest on the mounted suite and the model tests for those arms.
3. **The `conflict` outcome was not provoked**, exactly as `2c-3b-2-window-reading.md` §10.2 records
   for a move: an external write through the IPC is caught by the command's identity gate first, so
   the three `revision*` sentences and `cannotDuplicate.conflict` have model-suite and mounted
   evidence only. Reaching them from a window needs a filesystem write timed between the gate and
   the lock.
4. **Three `DuplicationRefusal` arms were never drawn** — `readOnly`, `notInDocument` and
   `noSequencePosition`. Only `unsavedDraftInDocument` reached a transcript.
5. **`duplicationRecoveryFailed` was not driven** — the recovery re-read that fails, and the
   `reloadFailed` sentence beside it. It has model and mounted evidence and no window evidence.
6. **`mayHaveWritten` was never seen beside a definite claim**, because the pair is unreachable: a
   spent session cannot send again. The half a window can show is that the uncertain sentence stands
   where a definite one would be.
7. **`findingsAreStale`, the `notes` list and the in-flight `duplicating` marker were never on a
   transcript.** The first two are unreachable for a duplicate as the core stands; the third is
   transient and was never sampled mid-send.
8. **Pixels, pointer hit-testing and real keystrokes** — unchanged since `1c-1-notes.md` §10.3. Pane
   scrolling was an assignment to `scrollTop`.
9. **The real configuration was never opened** (D1, deliberately).

**From this step's own code:**

10. **Nothing forces the `projections` prop to answer a live array.** The one-read rule is honoured
    at this call site and nothing in TypeScript keeps it honoured; §2.1 states what is enforced
    beside what is not.
11. **`documentHasUnsavedDraft` cannot check that the caller passed every open editor.**
    `openMatchDrafts()` returns at most one identity today because this pane holds one small-editor
    session; the list shape is what makes a second concurrent editor a value added rather than a
    rule rewritten in two places.
12. **Excluding the whole-document raw editor from the predicate is safe only while `busy` keeps the
    surfaces mutually exclusive.** Relaxing that exclusivity turns this into a real stranding hole
    and needs its own sentence, not a silently broadened predicate.

**Recorded by the reading and deliberately not fixed:**

13. **§10.1 (Low) — the committed panel makes the same claim twice, five lines apart.** The
    `alreadyDuplicated` refusal in the action row and the `duplicated` outcome sentence both open
    *"This snippet has been copied"*. Each is right for its own place; a person reads one screen.
    **This is `2c-3b-2-window-reading.md` §7.2 inherited unchanged**, and it keeps that record's
    disposition: cosmetic, recorded because it was seen.
14. **§10.2 (Low) — when the panel is taller than the pane, the committed outcome lands below the
    fold and nothing scrolls to it.** Measured in the real pane over a 2 859-character label. The
    person is not uninformed (the pinned row already says the copy happened) and not stranded (a way
    out is at the top). **Not fixed for two reasons**: scrolling the outcome into view is a change
    to a component, and a change to `MatchDuplicator.svelte` obliges a re-taken window reading; and
    whether a save may move the pane under a reader is its own decision, not a cleanup.
15. **§10.3 (Observation) — at the bottom of a pane shorter than the outcome panel the sticky row
    returns to its natural place and can leave the pane.** `position: sticky` as specified, seen
    only in an instrument whose pane was shortened on purpose to 260 px, never in a real-pane
    launch, and in a state where the control it carries is disabled.
16. **§10.4 (Observation) — four sentences of two kinds share one visual register** on the
    committed-with-failed-adoption panel. Not ambiguous as drawn, because each names its subject in
    its opening words and the order is transaction, window, outcome. Worth writing down because the
    distinction is carried **entirely by the sentences**: a later message opening with a pronoun
    would blur it and no test here would fail.
17. **§10.5 (Observation) — the primary control stays enabled while an unacknowledged refusal is on
    screen.** Correct (a refusal is about one candidate and the file may have changed), and it is
    `MatchMover.svelte`'s and `RawEditor.svelte`'s shape too, so it is a family property rather than
    this panel's.

---

## 5. What this step deliberately did not do

- **No Rust, no command, no wire change.** The count is unchanged at 1046 and
  `cargo tree -p espansoconfig-core | rg tauri` is still empty.
- **No new dictionary key**, and no change to any sentence outside the one refusal per language. A
  sentence in a shipped screen obliges a re-taken reading of the sub-phase that owns it, which is
  why §6.3's debts were recorded rather than fixed in passing.
- **No placement control, no confirmation dialog and no undo.** The copy lands immediately after its
  source (consult Q4) and the deliberate second step is the acknowledgement round trip the
  transaction already imposes (Q6); a committed insertion is an ordinary save boundary, so the only
  control offered after a commit is a way out of it (Q8). The reading confirmed the complete roll of
  controls this surface ever drew contains no undo, revert, restore or "keep my draft".
- **No back-fill of the six components that predate `RawEditor.svelte`.** The jsdom decision stays
  scoped; `environment: 'node'` is still the default and `resolve.conditions` was not touched.
- **No widening of `documentHasUnsavedDraft` to the raw editor** — hole 12.

---

## 6. The review rounds

`docs/reviews/phase-2c-3c-3-code.md` — Codex, two rounds, **`READINESS: NOT READY` both times**. The
verdict was accepted rather than argued with in each case, and every finding was fixed before the
commit. The standing rule held again: **round 1's two fixes were behaviourally correct, and both of
round 2's findings were prose those fixes introduced.**

### 6.1 Round 1, finding 1 (Medium) — a rule living in the component. Accepted, fixed.

The component decided that the frozen `notDuplicable` reason loses to a live `outOfDate`. §2.2 is
the fix and its rationale; the two model cases and the two mounted cases are the evidence. Round 2
confirmed the behaviour **closed, not relocated**: the view computes the presentation-ready answer
from the same `cannotDuplicate` that drives `canDuplicate`, the component performs only a null
check, both new model cases have non-vacuous live halves and would fail against the old view, and
removing the old member weakened no caller or test in the repository.

### 6.2 Round 1, finding 2 (Low) — a sentence false of its own predicate. Accepted, fixed.

§2.3 is the fix. Round 2 confirmed both languages state the open-editor predicate exactly, that the
Spanish makes the same open-versus-dirty distinction with a conditional rather than an assertion,
that the dictionaries hold all 699 keys in exact parity with no placeholder mismatch, and that the
touched model, prop, parameter and coordinator comments describe an open editor throughout.

### 6.3 Round 2, finding 1 (Low) — a false testability record. Accepted, fixed.

§2.4 is the fix, and the sweep is what made it more than a comment edit: `matchDuplication.ts`'s
header, the model test's own comment, the component's note and `DetailPane.svelte`'s pre-existing
absolute all now say the narrow, true thing.

### 6.4 Round 2, finding 2 (Low) — the governing records still claimed dirty-draft coordination. Accepted, fixed.

§2.3's last part is the fix: correction blocks appended to `2c-3c-2-notes.md` §2.4 and to
`phase-2c-3c-design.md` in both the places that claimed it, including the completion criterion a
future session could otherwise read as met.

### 6.5 The debt this step found and did not fix

Two items, both in `move`, both shipped, and both left for the sub-phase that next owns that screen —
the same rule that keeps `browser.matchDeletion.sendFailed` and `browser.rawEditor.discardWarning`
outstanding:

- **`browser.matchMove.refused.unsavedDraft` (`en.json:316`, `es.json:316`) has the identical
  open-versus-dirty defect.** It says *"This snippet has edits that have not been saved"*, while its
  producer — `unsavedDraftFor()` in `DetailPane.svelte`, which returns `editingMatch.match.id` — is
  the same open-editor question `documentHasUnsavedDraft` asks. Fixing it changes a sentence on the
  move screen, which obliges a re-taken window reading of 2c-3b-2.
- **`MatchMover.svelte:511` carries the round-1 Medium's exact shape**:
  `{#if current.view.notMovable !== null && current.view.cannotMove !== 'outOfDate'}` — the
  precedence decision written into a `.svelte` file, shipped at 2c-3b and window-read there.
  Duplicate's model-side fix now **diverges** from it: two sibling panels resolve the same rule in
  two places, and only one of them is a decision a model test can drive. Moving it is a change to a
  component and therefore a re-taken reading, so it is recorded here rather than done in passing.

**Both join the standing ledger**, which is now four items:
`browser.matchDeletion.sendFailed`, `browser.rawEditor.discardWarning`,
`browser.matchMove.refused.unsavedDraft` and `MatchMover.svelte:511`'s in-component rule.

### 6.6 The gates, re-run after the rounds

The figures in §3 are the final run, taken after every fix and after the probe scaffolding was
removed. Three claims were re-derived by the orchestrator rather than accepted from a worker or a
reviewer: the probe scaffolding is gone
(`rg "render_probe|probe_plan|ECFG_PROBE|startProbe" src src-tauri/src scripts` finds nothing, and
the module count is back to 171 from the 172 the reading measured); the old contradictory view
member is gone (`rg "view\.notDuplicable\b|notDuplicable:" src/lib` finds nothing, while
`notDuplicable` survives correctly as a refusal *code*); and the dictionaries hold 699 keys each
with identical key sets.
