# Phase 2d-6-2 — match-editor external session and reapply

**Status: implemented, reviewed (§5), the review's two blockers re-derived and fixed, gates
green.** Risk class: **medium** — four new fields and two new transitions on one immutable session
value, the editor's reapply re-entered through a generalized entry that reads a correspondence
table, two shared primitives added to `src/lib/browser/reapply.ts` for the surfaces 2d-6-3 and
2d-6-4 will migrate, two new dictionary keys forced by two rulings, six reworded sentences from the
register review this step owed. **No `.svelte` file, no Rust, no new module, no `BrowserState`
member.** `git status` shows changes under `src/lib/browser/`, `src/lib/i18n/`, this file and the
review's two files under `docs/reviews/`, beside the four instrument paths already dirty and
`PROGRESS.json`, already modified when the phase began.

This is the first step that consumes what 2d-6-1 landed
([`2d-6-split-notes.md`](2d-6-split-notes.md) §2, the *2d-6-2* entry). It is bound by §3 entries
**6, 7, 8, 9, 11, 12, 19, 20 and 22** of that record, by 1b's seventh verdict arm
([`2d-6-1b-notes.md`](2d-6-1b-notes.md) §1.5 and §5 item 2), and by the register review 1a left
([`2d-6-1a-notes.md`](2d-6-1a-notes.md) §5 item 1). The consult behind them is
[`docs/reviews/phase-2d-6-design.md`](../reviews/phase-2d-6-design.md), Q2, Q3 and Q5.

---

## 1. What changed, per deliverable

Line numbers are of the final tree. `E` is `src/lib/browser/matchEditor.ts`, `R` is
`src/lib/browser/reapply.ts`, `I` is `src/lib/i18n/index.ts`.

### 1.1 The `externalConflict` field and the widened accessor (entry 6)

- **`MatchEditorSession.externalConflict: ExternalConflictModel<MatchBuffers> | null`** (`E:768`)
  — a field beside `outcome`, never an arm of it; `SaveOutcomeModel` stays save-only. The field's
  doc says what the type admits and the transitions keep: both a save conflict and an external
  conflict can be populated on a hand-built session, and only the transitions keep them exclusive.
- **`conflictOf(session): ConflictModel<MatchBuffers> | null`** (`E:1242`) — widened from
  `SaveConflictModel`: the external conflict first, then the outcome's conflict arm, with the
  precedence stated as a definite answer for a hand-built session and as deciding nothing on one
  this module built. `isEditable` refuses under either origin through it and needed no second rule.
  `startMatchEditor` (`E:1198`) seeds all four new fields inert.
- The view (`MatchEditorView`, `E:2952`) gains **`externalMessages: readonly ConflictMessage[]`**
  (`E:2997`) — the external conflict's own lines, beside `messages` and never merged into it, so a
  panel drawing `view.conflict` outside the save-outcome branch (entry 10) draws nothing twice — and
  **`externalNotices: readonly ExternalConflictNotice[]`** (`E:3009`), the two 1a codes answered
  from the session: `writeOutcomeUnknown` first, `observationRetained` second. No component reads
  either; 2d-6-6 and 2d-6-9 do.

### 1.2 "Cannot submit" at `canSave` and `beginSave` (entry 8)

- **`canSave`** (`E:1528`) refuses under a conflict of either origin (through `isEditable`) and
  under a held observation (`awaitingReconciliation !== null`); **`beginSave`** (`E:1604`) asks
  `canSave` first, so a call made past a disabled control answers **`null`** — pinned by
  *answers null from beginSave called directly under an external conflict* and by the retained
  case, both with a dirty draft and one through `acknowledgeFindings` (the *Save anyway* path). The
  docs say what the rule cannot force: that the session it is handed is current (R37).
- The view withholds a refusal panel's `saveAnyway` under either external block
  (`refusalChoices`, `E:3182`), leaving `keepEditing` — without calling the findings stale.
- **The reapply is a submission boundary too, and it refuses under a held observation** (§5,
  finding 1): `reapplyToDiskVersion` answers `manualResolution` with the obstacle
  `observationRetained` (`E:2701`) before any evidence is read, the view withholds `keepMyDraft`
  by the same fact (`effectiveCapabilitiesOf`, `E:2883`), and both rebuilds of a successful
  reapply go through **`rebuiltOver`** (`E:2751`), which carries `awaitingReconciliation` forward.

### 1.3 The receiver as a value: `applyObservation`, seven arms (entries 4, 5, 11)

**`applyObservation(session, delivery): MatchEditorSession`** (`E:2076`) switches over
`delivery.verdict.kind` with a `never` terminus — an eighth arm of `ObservationVerdict` is a
compile error there. The table in its doc is the record's entry 11 plus 1b's seventh row:

| Verdict | Action |
|---|---|
| `raised` | `describeExternalConflict` over the session's draft |
| `raisedWithoutReload` | the same, and `uncertaintyUnresolved: true` |
| `supersedes` | `supersedeConflict` over the conflict shown (its draft read off the model being replaced), or `describeExternalConflict` when none is shown |
| `coalesced`, `notLater` | the same session object, save for ending an awaited wait |
| `retained` | `awaitingReconciliation: observation` — no comparison, no origin |
| `writtenHere` | lifts the wait recorded for **that** observation, by identity; nothing else |

The three replacing arms share **`replacedBy`** (`E:2128`), which also retires a save conflict's
outcome and submission (entry 7 — a `saved` or `refused` outcome stays as history) and resets
`reload` to idle (entry 12). The only caller-controlled reads are the envelope's `observation`
and its verdict's `kind`, taken once before anything is decided. **Ruling 5 has a model home**:
while `phase === 'saving'` every envelope is appended to **`heldDeliveries`** (`E:840`) — a list in
arrival order, since the review (§5, finding 2), not the slot the phase first shipped — and
`applySave` (`E:1715`) and `saveCouldNotBeSent` (`E:1829`) replay the whole list first to last,
after their own answer, through the private **`consumingHeldDeliveries`** (`E:1793`), so every
decision the window published before the continuation ran — the settlement's, and any a sibling's
re-publication provoked — has its say in the order it was made; §2 item 1 says why this is here.

**`applySave` keeps entry 7 from the other side**: a `saved` or `conflict` answer retires the
external conflict, a `refused` answer leaves it — a path `beginSave` never reaches, kept for a
direct call and pinned by *the reverse collision*.

### 1.4 The replacing verdict's reset, and the dismissal that erases nothing (entries 9, 12)

- `replacedBy` writes `reload: NOT_RELOADING` — the confirmation collected under the superseded
  conflict is gone from the session and `reloadTheDiskVersion` answers `notAttempted` without
  asking the door (pinned with a recorder). A displayed reapply result is invalidated by the same
  transition because `reapplyToShow` in `./reapply.ts` pairs a report to a session by identity and
  every replacing arm answers a new session — pinned by `attemptOfReapply`/`reapplyToShow` in
  *resets the reload, drops the confirmation and invalidates a displayed reapply result*. Field
  intent (`fieldIntent` still `Set 'c'`), the draft's history and a `refused` outcome survive.
- **`keepEditing`** (`E:1889`) is unchanged in code and changed in contract: its doc names the
  three fields the spread carries over, and *lets keepEditing cancel the warning and the save
  panel, and nothing external* pins that the conflict, the uncertainty and the wait all stand.

### 1.5 `raisedWithoutReload`: reload and reapply withheld until acknowledged (entries 11, 15, 22)

- **`uncertaintyUnresolved: boolean`** (`E:787`). While `true`: the private
  **`effectiveCapabilitiesOf`** (`E:2883`) hands `conflictChoicesFor` the declaration with
  `offersReload: false, offersReapply: false` — the consult's "effective capabilities" — so the
  choice list is `['keepEditing', 'copyDraft']`; the private **`reloadableConflictOf`** (`E:1915`)
  makes the three reload transitions (`E:1927`, `E:1942`, `E:1976`) refuse a call made past the
  withheld control; and `reapplyToDiskVersion` refuses with a new obstacle **`writeOutcomeUnknown`**
  before reading any evidence, adopting nothing.
- **`acknowledgeSnapshot(session, acknowledge: AcknowledgeTheUncertainty)`** (`E:2205`, the type
  `E:2173`) — the window's two acknowledgement members composed into one two-valued callback taking
  the shown conflict's own `source`; only `acknowledged` clears the flag and puts the reload back
  at idle. Asked at most once and only when there is something to end. The 1b members are called
  from `workspace.test.ts` exactly as a 2d-6-9 control will call them.

### 1.6 The reapply over both origins, and the row lookup by full identity (entries 19, 20, 22)

In `R`, shared so 2d-6-3 and 2d-6-4 take `exact` from the same table:

- **`ReapplyEntry<T>`** (`R:355`) and **`enterReapply(capabilities, conflict, standing)`**
  (`R:406`) — `beginReapply` generalized: the same support gate, either origin, and the `ready` arm
  carries `reapplyEvidenceFor`'s four-armed `ReapplyEvidenceAccess` with the guard asked last.
  `beginReapply` stays for the raw editor, the four operation surfaces and the recovery form, and
  says so.
- **`CorrespondenceRowRefusal = 'noRowForBase' | 'severalRowsForBase'`** (`R:447`), folded into
  **`ExternalEvidenceRefusal`** (`R:465`) so `tExternalEvidenceRefusal` renders every way the
  external evidence refuses; **`CorrespondenceRowLookup`** (`R:741`) and
  **`correspondenceRowFor(table, base)`** (`R:800`) — document, revision and node all compared,
  the three captured once before the loop, each row's `base` read once; zero rows and two rows
  both refuse. **`subjectResolution(resolution)`** (`R:883`) factored out of
  `subjectCorrespondence` (`R:859`) so a row's `editor` answer is read with the three-arm rule and
  no `ReapplyEvidence` is manufactured around it.

In `E`: **`reapplyToDiskVersion(session, adopt, standing = null)`** (`E:2681`) enters through
`enterReapply`; the private **`subjectOfEvidence`** (`E:2794`) switches over the four access arms
with a `never` terminus — save evidence as before; the external table searched for `session.match`
and the found row's `editor` tier read once; a refused table or row → `manualResolution` with
obstacle `externalEvidence` (typed sentence `tExternalEvidenceRefusal`); superseded →
`supersededEvidence` (`tSupersededEvidence`). **`EditorReapplyObstacle`** (`E:2445`) gains those
two arms, `writeOutcomeUnknown` and, since the review, `observationRetained` (`E:2531`); **`editorReapplyObstacleKey`** (`E:2559`) maps them to
`externalEvidenceRefusalKey`, `SUPERSEDED_EVIDENCE_KEY` and `externalConflictNoticeKey(
writeOutcomeUnknown)` — the last reuses the notice's sentence and adds no key. `I`'s
**`describeEditorReapplyObstacle`** (`I:1611`) is now a `switch` with a `never` terminus over the
seven arms. The guard parameter is **optional**, and §2 item 3 says why and what it costs; the
private **`unaskedGuard`** (`E:2771`) is what an omitted guard becomes.

### 1.7 The register review, and the two keys two rulings forced

- **Two new keys, both dictionaries**: `browser.reapply.externalEvidence.noRowForBase` and
  `.severalRowsForBase` (`en.json:155-156`, `es.json:155-156`), each ending *This reapply attempt
  wrote nothing.* / *Este intento de reaplicar no ha escrito nada.*, bounded by the entry 40 scans
  (added to `BOUNDED_KEYS`). **They are forced by entries 20 and 22 read together**: a missing or
  duplicate row must refuse, the refusal must reach manual resolution with `tExternalEvidenceRefusal`'s
  typed sentence, and none of the three existing arms says either thing honestly — *carried no
  correspondence for it* is false of a table with a row for every other snippet, and false twice of
  a table with two rows for this one.
- **Six reapply-outcome sentences reworded, both dictionaries** (`en.json:142-147`,
  `es.json:142-147`): the four umbrella sentences 1a named — `manualResolution`, `adoptionRefused`,
  `unavailable`, `notAttempted` — **and the two success arms the same review found beside them**,
  `reapplied` (*Nothing has been written yet*) and `alreadySatisfied` (*Nothing was written*). Each
  now bounds its claim to the attempt — *this reapply attempt wrote nothing* — because after a
  write of this window's own with an unknown outcome the unbounded form is a claim about the file
  nobody can make; nothing else in any of the six changed. `I:1435`'s *"says only that nothing was
  applied, written or moved"* now says *this attempt applied nothing, wrote nothing and moved
  nothing*, with the reason. Pinned in both languages by *pins every reapply outcome sentence to a
  claim about this attempt* (`externalConflictCodes.test.ts:268`), which also asserts the absence
  of the old clause.

### 1.8 Sentences corrected (entry 41), all in files this diff touches

| File | Sentence falsified | Correction |
|---|---|---|
| `observationDelivery.ts`, module header | "no component and no session transition consumes either yet" | the editor's `applyObservation` consumes the envelope; no component registers it (2d-6-6) |
| `observationDelivery.ts`, `ExternalConflictNotice` | "The session state that shows the first is 2d-6-2's" | `MatchEditorView.externalNotices` answers both; no component reads it; 2d-6-9 draws the control |
| `conflictSource.ts`, `ObservationVerdict` header and `writtenHere` arm | "the session transition's, which is 2d-6-2's" | the editor's is named; the identity rule of the lift stated |
| `saveOutcome.ts`, `ExternalConflictModel` header | "today that producer has no caller outside this repository's tests"; "The session transition … is Phase 2d-6-2's" | first production caller named; the wiring still 2d-6-6's |
| `workspace.svelte.ts`, `ObservationReceiver` | "which is 2d-6-2's" | present tense, no registrar yet |
| `reapply.ts`, `ExternalEvidenceRefusal` | "Three refusals and no fourth" | three about the table, two about its rows |
| `reapply.ts`, module header and `beginReapply` | (the entry protocol described as save-only) | `enterReapply`, `correspondenceRowFor`, `subjectResolution` named; `beginReapply` the save-only predecessor the other surfaces still call |
| `i18n/index.ts`, `describeExternalEvidenceRefusal`, `describeSupersededEvidence` | "None of the three sentences"; "the three above" | five; the editor's obstacle path named |

**Left alone, deliberately**: `saveOutcome.ts` / `index.ts`'s "Nine codes" (1a §5 item 2 — the
code list did not change here); "Today every registered transition is a no-op" in
`observationTransitions.ts` and `writeSurfaceRegistry.ts` — still true, no production transition
changed; `reapply.ts:229`'s "no save was attempted", a true statement about the reapply path.

## 2. Rulings taken here

1. **Ruling 5's hold lives on the session, not in a component slot.** Entry 5 is bound to 2d-6-1
   and 2d-6-6, and the ordering it rules on is a mounted fact; but a component-local slot for the
   held envelope would be exactly the "authoritative conflict state in a component-local slot"
   entry 6 (c) rejected, and without the hold `applySave` after `applyObservation` would leave
   ruling 7 undecidable. So `applyObservation` holds while `phase === 'saving'` and both endings of
   a save replay the hold. **Every envelope is kept, in arrival order** — the phase first shipped a
   slot keeping the latest one, on the argument that a settlement always decides the reading the
   barrier held last; the review showed that the settlement's `raised` need not be the last
   envelope a save in flight is told (§5, finding 2), so the argument was true of the settlement
   and false of the window. What 2d-6-6 still owes is the mounted proof that the component calls
   `applyObservation` synchronously from its receiver.
2. **The retained restriction is keyed on the observation's identity and lifted by any decision
   about it.** 1b's text is "lift the restriction recorded for that observation"; a `raised`,
   `coalesced` or `notLater` about the awaited observation is equally a decision about it, and
   leaving the wait standing under a conflict about the same reading would show a false notice. A
   later `retained` replaces the awaited observation (the barrier keeps the newest). The limit is
   stated on the field (§4 item 2).
3. **The standing-origin guard is an optional parameter, defaulting to the conflict's own origin.**
   `MatchEditor.svelte` calls `reapplyToDiskVersion(session, adopt)` and this phase touches no
   component; a required parameter would not compile, and `() => null` as a default would turn the
   component's save-origin reapply into `supersededEvidence` today. The default asks no supersession
   question, which is what `StandingOriginGuard`'s doc names as defeating the check; what still
   refuses an outlived origin on that path is `adoptDiskVersion`'s fourth check at the door, as
   `adoptionRefused` and without the typed sentence. Pinned by *asks nothing of the window when no
   guard is handed in*. 2d-6-6, which hands the live closure through the narrow prop, may make the
   parameter required.
4. **Editing stays live under a held observation; only sending is refused.** Entry 8 says
   "unresolved retained delivery" blocks submission; nothing about it needs the retained-draft
   pairing a conflict protects, and blocking keystrokes for a window decision that has not been
   made would be a stronger claim than the fact supports.
5. **`raised` over a session already showing a save conflict retires it too.** A hand-built order —
   the wrapper registers a save conflict as standing, so the window would answer `coalesced` or
   `supersedes` — and the model keeps entry 7 for it all the same: the newest decision for the file
   is what the session shows.
6. **The reapply under uncertainty is refused, not merely unoffered.** Entry 22 forbids obtaining
   adoption internally; a reapply that decided but could not adopt would have nothing honest to
   hand back, so both the control and the transition are withheld — the control through the
   effective capabilities, the transition before any evidence is read.
7. **`writeOutcomeUnknown` as an obstacle reuses the notice's sentence.** The reason a reapply
   refused under uncertainty is exactly the uncertainty notice's sentence, under `manualResolution`'s
   *The reason follows*; a second key would have been a second wording of one fact.
8. **The two success arms are in the register review.** The task named four sentences; the review
   found `reapplied` and `alreadySatisfied` making the same unbounded claim in the same register and
   corrected them in the same diff rather than leaving two of six saying *nothing was written*.

## 3. Verification

Run from the repository root on the final tree, each gate on its own, each exit read directly:

| Command | Exit | Evidence |
|---|---|---|
| `npm run check` | 0 | `/tmp/2d-6-2-check.txt` — **447 files, 0 errors, 0 warnings** |
| `npm test` | 0 | **2574 → 2618 passed, 64 → 64 files** (2614 before the review's four cases) |
| `npx vitest run src/lib/browser/matchEditor.test.ts` | 0 | **101 → 128** (+27: the suite *the external session — Phase 2d-6-2*, `matchEditor.test.ts:1849` — 4 raising, 6 collisions, 5 verdict arms, 3 entries 12/9, 9 reapply; two of those from §5) |
| `npx vitest run src/lib/browser/workspace.test.ts` | 0 | **288 → 296** (+8, the nested suite *the match editor's external session — Phase 2d-6-2*, `workspace.test.ts:9927`; two of those from §5) |
| `npx vitest run src/lib/browser/reapply.test.ts` | 0 | **29 → 37** (+8, the suite *the entry over both origins, and the row lookup by full identity*, `reapply.test.ts:538`) |
| `npx vitest run src/lib/i18n/externalConflictCodes.test.ts` | 0 | **21 → 22** (+1, the register pin at `:268`; the five-refusal loop and `BOUNDED_KEYS` grew without adding a case) |
| `scripts/lint/ipc-detail.test.ts` | — | 141 → 141: no new file under `src/` |
| `npm run build` | 0 | `/tmp/2d-6-2-build.txt` — **192 modules transformed**; no new module |
| `rg -c '\$\$payload\|head_payload\|push_element' dist/assets/index-*.js` | 1 | server-only markers absent |
| `rg -c 'window\.__svelte\|svelte-trusted-html' dist/assets/index-*.js` | 0 | prints `2` — client-only present |
| Cargo | not run | no path under `src-tauri/` or `crates/` changed beyond the instrument |

Per-file *before* figures are the JSON reporter's on the current tree minus the cases this diff
added, cross-checked against the total: 27 + 8 + 8 + 1 = 44 = 2618 − 2574 (40 at the first
landing, 44 after §5's four cases). The build and the bundle oracle were re-run on the final tree
with the same figures.

**The acceptance clauses, pinned.** Pristine and edited drafts: *raises over a pristine draft* and
*raises over an edited draft* (`matchEditor.test.ts`). Collisions both ways: *retires a save conflict
when an observation supersedes it*, *the reverse collision*, *keeps a committed success and a
refusal as history*. All four evidence arms: save evidence through the same entry (*refuses
superseded evidence through the live guard, whichever origin*), external correspondence (*rebuilds
the draft over the snippet the row identified*), specific refusals (*refuses a table about other
revisions, and an observation with none*; *no row … or several*), superseded (*through the live
guard*). All three adoption outcomes: *answers every adoption outcome for the external origin* in
the model, and *resolves the conflict through the real door: installed, alreadyThere and refused*
against `BrowserState.adoptDiskVersion`. Every verdict arm including `writtenHere`: the *every
verdict arm has an action* suite, and *is told retained through the barrier and then the
settlement's verdict* against a real barrier for both `retained → raised` and `retained →
writtenHere`. `beginSave` direct under an external conflict: `null`, in both files. `keepEditing`
under an external block: *lets keepEditing cancel the warning and the save panel, and nothing
external*. Replacing verdict reset: *resets the reload, drops the confirmation and invalidates a
displayed reapply result, keeping intent and history*; *keeps save history through a replacing
verdict*. The command spy: every `workspace.test.ts` case asserts `invoked` at zero and the file's
`afterEach` re-asserts it, with every write lease released and no drain scripted or made.

**Each new behaviour was confirmed to fail against the pre-change shape.** The four fields, the two
transitions, the widened `conflictOf`, `enterReapply`, `correspondenceRowFor`, `subjectResolution`
and the three obstacle arms did not exist, so every case naming one failed to compile against the
pre-change tree (`svelte-check` reported the growing `ExternalEvidenceRefusal` table in
`reapply.test.ts` first, before any test was written). For the four rules that change an existing
function's behaviour, the rule was mutated in place and the suite run, then the file restored
byte-identical from a copy (`diff` empty): dropping `awaitingReconciliation === null` from `canSave`
failed *records a held observation …* and *lets keepEditing …* (`expected true to be false`); making
`reloadableConflictOf` ignore the uncertainty failed *withholds the reload and the reapply on
raisedWithoutReload* (`askToReloadDiskVersion(withheld)` no longer the same object); adding
`externalConflict: null` to `keepEditing`'s literal failed *lets keepEditing …* (`expected null to be
{ kind: 'conflict', … }`); keeping the external conflict beside a save conflict in `applySave` failed
*the reverse collision* (`expected { kind: 'conflict', … } to be null`).

Only `git status`, `git diff --stat` and `git show HEAD:<path>` (read-only, into `/tmp`) were run.
The four instrument paths are untouched (`git diff --stat -- src-tauri/src/main.rs src/main.ts` reads
`5 insertions(+), 1 deletion(-)`); `PROGRESS.md` and `PROGRESS.json` were not edited.

## 4. Where it is thin, and open items left deliberately

1. **A hold the window ends without a delivery is unseen by the session.** The uncertainty hold
   has three exits; the acknowledgement is the only one that passes through `acknowledgeSnapshot`,
   and a later definite write of this window's own (or `open()`) delivers nothing to a session. A
   conflict raised `raisedWithoutReload` then stays withheld here until a fresh verdict replaces it
   or the person acknowledges — and the window, whose hold is gone, answers `holdMoved`, which the
   two-valued callback reports as `refused`, so the session stays withheld. Stated on the field
   and on the transition. 2d-6-9, which draws the control and the state, is where the question
   belongs: whether a `holdMoved` refusal should rebuild availability, or whether the session should
   be told the hold ended (a delivery kind, or a reader of `automaticReloadGuardFor`).
2. **A reading the barrier coalesced away is never announced.** The barrier keeps the newest
   observation and drops an older arrival without a verdict; a session told `retained` about a
   reading that a newer held one outranks waits for a decision that will not come. In production the
   coordinator admits observations in sequence order, so the last `retained` a session is told is
   the reading the barrier keeps; the case is reachable only through the public
   `observeExternalChange` out of order. Stated on `awaitingReconciliation`.
3. **The `superseded` origin a `supersedes` verdict names is not compared with the shown conflict's
   source.** The envelope is the window's one decision about the file and a session that re-checked
   it would be arbitrating (entry 11); the cost is that a hand-built envelope naming another
   superseded origin is taken at its word. The memoized `source` on the model still has to match
   the window's registration for any adoption to succeed.
4. **The optional guard** (§2 item 3): an omitted guard costs the typed supersession sentence and
   some computation, never a wrong installation. 2d-6-6 should make the parameter required when it
   passes the prop, and the doc on `reapplyToDiskVersion` says so.
5. **No `removed`-status transition for the editor** (the record's §6 item 12). Not in this step's
   entry and not taken here; the record says each model step claims its surface's or 2d-6-9 grows
   model work. Left for the orchestrator to place.
6. **A save conflict shown while the file is under the uncertainty hold offers the reload.** The
   session was never told `raisedWithoutReload` — a save conflict arrives through `applySave`, not
   a delivery — so `uncertaintyUnresolved` is `false` and `adoptDiskVersion` does not consult the
   hold. 1b widened the acknowledgement's operand to `ConflictSource` for exactly this file state;
   whether the editor should withhold the reload for a save conflict under the hold is 2d-6-9's, and
   `acknowledgeSnapshot` would need to read the save conflict's source to help.
7. **`heldDeliveries` replays in arrival order and vouches for nothing about that order's
   provenance.** What the list forces is that no envelope delivered during the save is dropped and
   that they are applied first to last; that the window delivered them in the order it decided them
   is the window's contract (`deliver`'s queue, 1b), and that a decision made against the window's
   tables is still apt against the session once the save's answer is on it is not checked — each
   envelope meets the same rules it would have met on arrival. The slot this replaced, and the
   sentence that called it right for every settlement path, are §5's finding 2.
8. **The Spanish of the two new sentences and the six reworded ones is the implementer's draft**,
   unreviewed by a bilingual reader — 1a §5 item 5's condition, extended to eight more sentences;
   ruling 40's bilingual review is 2d-6-11's.
9. **`ExternalConflictAction` still has one arm**, and no i18n key was added for any refusal
   reason: every refusal in this phase is a decision or reuses an existing sentence, except the two
   row refusals that entries 20 and 22 forced.
10. **No mounted evidence** (components: none). The receiver is registered by no component, the
    ordering of a delivery against this editor's own `await save(...)` is 2d-6-6's mounted test, and
    the view's two new fields are read by nothing that draws.
11. **1b's and 1c's open items stand** (`2d-6-1b-notes.md` §5, `2d-6-1c-notes.md` §5): the
    `ReconciliationWorkspace` delivery member, `classifyFailure`'s "never throws", the hostile
    `sequence` getter on the retry's restore path, the registration rejection with no developer
    channel. The `writtenHere` session action 1b left (§5 item 2) is discharged here (§1.3).
12. **`adoptDiskVersion` has no write-in-flight guard** (found by the review's first finding,
    §5). A confirmed reload from any surface installs a conflict's snapshot while another surface's
    write of the same file is out and a reading is held behind it. The editor's reload closes the
    editor and sends nothing, so nothing of this phase's is unsafe; whether the door should refuse
    while `writesInFlight` is non-zero is a `BrowserState` question for the step that next changes
    `adoptDiskVersion`, and is stated rather than taken here.

## 5. The review's two findings, re-derived

**Codex adversarial review, do-not-ship: 2 BLOCKERS, 0 SHOULD-FIX**
([`docs/reviews/phase-2d-6-2.md`](../reviews/phase-2d-6-2.md)), both in
`src/lib/browser/matchEditor.ts`. Each was re-derived against the pre-fix tree by writing the
failing case first — at the model level in `matchEditor.test.ts` and through a real `BrowserState`
in `workspace.test.ts` — and reading its failure; both held. The reviewer records that it checked
and did **not** uphold `writtenHere` identity, adoption through the omitted guard, or repeated
correspondence-row reads; those paths were left alone. No re-review follows this fix
(`CLAUDE.md` §7).

1. **[BLOCKER] `reapplyToDiskVersion` — a reapply discarded an unresolved observation's submission
   block. Held.** External conflict A stood; another surface's write was in flight; reading B
   arrived and was held, so `awaitingReconciliation` was recorded and `canSave` refused — and the
   reapply then read A's evidence, adopted through the real door (`adoptDiskVersion` has no
   write-in-flight guard) and handed back a session built by `startMatchEditor`, whose
   `awaitingReconciliation` is `null`, so the blocked submission was allowed through the fresh
   session's ordinary *Save*. **Cases:** *refuses a reapply while an observation is held, so no
   rebuilt session can drop the block* (`matchEditor.test.ts:2614`, stub adopter) and *refuses a
   reapply while a reading is held behind another surface's write, through the real door*
   (`workspace.test.ts:10248` — 1b's `observeExternalChange` through a registered receiver, a raw
   save held open, `state.adoptDiskVersion` and `state.standingConflictFor` as the adopter and the
   guard). **Pre-fix failures, verbatim, both files:** `AssertionError: expected { kind:
   'reapplied', …(1) } to deeply equal { kind: 'manualResolution', …(1) }`; the window case's
   `afterEach` then also reported the write lease the throw left open. **Fix:** a new
   `EditorReapplyObstacle` arm `observationRetained` (`E:2531`), keyed to the retained notice's own
   sentence through `externalConflictNoticeKey` — no new key; `reapplyToDiskVersion` refuses with it
   before any evidence is read and before the door (`E:2701`), after the uncertainty refusal;
   `effectiveCapabilitiesOf` (`E:2883`) withholds `keepMyDraft` while a reading is held, so the
   control and the transition answer from one fact; and both success arms rebuild through the new
   `rebuiltOver` (`E:2751`), which carries `awaitingReconciliation` forward. **What that does not
   force:** the carried value is `null` on every path this module takes, because the refusal comes
   first — it is carried so the rebuild's honesty does not depend on the refusal's position, and
   no test can tell the two apart, which the function's doc says rather than claiming coverage. The
   reload is not withheld for a held reading, deliberately: it closes the editor and sends nothing,
   and whether the window should refuse an adoption while another surface's write is in flight is
   `adoptDiskVersion`'s question, not this session's (§4 item 12). **Post-fix:** both cases pass;
   the window case goes on to release the write and shows the settlement deciding B as
   `supersedes`, with the wait over and a conflict still standing.

2. **[BLOCKER] `applyObservation` — the latest-envelope hold erased a conflict before it was applied.
   Held, in the reviewer's exact interleaving.** During the editor's own save the barrier delivered
   `retained(A)`; the save was refused, so the settlement delivered `raised(A)` from inside the
   wrapper's `finally`; a sibling receiver over the same file answered that `raised` by publishing a
   later reading of the same bytes, which the window decided `coalesced` and handed to every
   receiver through 1b's delivery queue — all before the editor's `await` resumed. The slot kept
   `coalesced` and dropped `raised(A)`; the replay found no conflict to coalesce into; the session
   ended with no external conflict although the file had changed under it. **Cases:** *replays
   every delivery held during its save in order, so a raised is not lost behind a later coalesced*
   (`matchEditor.test.ts:2183`, the three envelopes sealed by 1a's constructors) and *keeps a raised
   conflict delivered during its own save when a sibling's coalesced follows it before the
   continuation* (`workspace.test.ts:10305` — a deferred `saveMatch`, the editor's own
   `beginSave`/`state.saveMatch`, a second receiver that re-publishes on `raised`, the answer
   applied through `applySave` after the `await`). **Pre-fix failures, verbatim, both files:**
   `AssertionError: expected undefined to be { kind: 'externalChange', …(1) } // Object.is
   equality`. **Fix:** the slot `heldDelivery: ObservationDelivery | null` became the list
   **`heldDeliveries: readonly ObservationDelivery[]`** (`E:840`); `applyObservation` appends while
   `phase === 'saving'`; `consumingHeldDeliveries` (`E:1793`) empties the list first and replays
   every envelope first to last through `applyObservation`, each applied to the session the one
   before it left. The window case also pins the order held —
   `['retained', 'raised', 'coalesced']` — as the order 1b's queue delivered it. **What the list
   forces and what it does not**, stated on the field: every envelope delivered during the save is
   applied, in arrival order; it does not force that arrival order was decision order (the
   window's contract), that a decision taken against the window's tables is still apt against the
   session once the save's answer is on it (each envelope meets the rules it would have met on
   arrival), or that a component applies deliveries through this module at all. §2 item 1 and §4
   item 7 were corrected accordingly; the sentence "latest-only is right for every settlement
   path" was true of the settlement's own envelope and false of the window, and is gone.

After the fixes: `npm run check` exit 0 (447 files, 0 errors, 0 warnings); `npm test` exit 0
(2618 passed, 64 files: +2 in `matchEditor.test.ts`, 126 → 128; +2 in `workspace.test.ts`, 294 →
296); `npm run build` exit 0 (192 modules; server-only markers absent, client-only present (2)).
No `.svelte`, no Rust, no new module, no new i18n key; the instrument paths are untouched.
