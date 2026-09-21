# Phase 2d-6-1a — delivery values, shared conflict primitives and origin-correct messages

**Status: implemented, gates green, awaiting the phase's one review.** Risk class: **low** — one
new production `.ts` module that nothing in production consumes yet, additive changes to two
existing browser modules and the i18n layer, two new test files, no `.svelte` file, no Rust, no
`BrowserState` member. `git diff --stat` over `src/lib/components/` and `src-tauri/` (beyond the four
instrument paths) is empty on the final tree.

This is the first of the three sub-phases the orchestrator cut 2d-6-1 into
([`2d-6-split-notes.md`](2d-6-split-notes.md) §2, *The orchestrator's cut of 2d-6-1*). It is bound by
§3 entries **4, 10, 11, 13, 14, 15, 24, 39, 40 and 41** of that record and by §5.5 and §5.6. The
consult behind them is [`docs/reviews/phase-2d-6-design.md`](../reviews/phase-2d-6-design.md).

---

## 1. What changed, per deliverable

### 1.1 The delivery envelope as a value (entry 4) — `src/lib/browser/observationDelivery.ts`, new

`ObservationDelivery` is `{ observation, verdict }`: the narrowed `ExternalConflictObservation` plus
the `ObservationVerdict` the window reached about it. **Two constructors and no generic one.**
`arbitratedDelivery(standing, observation, writeOutcomeUncertain)` runs `arbitrateObservation` on the
very observation it seals, so the verdict's `source` (on the three replacing arms) can only wrap that
observation; `retainedDelivery(observation)` seals the one arm a pure arbitration can never answer. A
constructor taking a ready-made verdict was considered and rejected: it would accept a verdict minted
for another observation, and a recipient could not tell. Both freeze the envelope shallowly. The
module's doc says what TypeScript cannot force — a hand-written literal of the shape type-checks and
gets no pairing guarantee.

`ReplacingVerdict` (`Extract<ObservationVerdict, { source }>`) and `isReplacingVerdict()` name the
three arms that carry a new origin — `raised`, `raisedWithoutReload`, `supersedes` — because entry 12
is written over that distinction (a replacing verdict resets the surface's reload step); the switch
has a `never` terminus and the test drives all six arms.

No `BrowserState` member consumes any of it: 2d-6-1b's arbitration/delivery member does (entry 42:
shared facilities land before callers activate).

### 1.2 The shared revision description and the type guards (entry 10)

- **`ConflictRevisionDescription` and `conflictRevisionsOf(source)`** in `conflictSource.ts`. One
  typed value over both origins, deliberately asymmetric: the save arm names `expected`, `found`,
  `observed` and `changedAgain` (the latter the same `found !== disk_revision` comparison
  `describeConflict` makes); the external arm names **`observed` only**. `previousRevision` is never
  read by it, and there is no `found` to manufacture — both are structural absences on the arm, not
  values left `null`. Every operand is read once off the origin and the answer is frozen. The test
  asserts the four absent names on the external arm, that no value of the description equals the
  observation's `previousRevision`, and that each save revision is read exactly once.
- **`isSaveConflict()` and `isExternalConflict()`** in `saveOutcome.ts`, narrowing the **model**. They
  exist because `model.source.kind === 'save'` narrows `model.source` and leaves `model` the union
  (2d-5-5a §8 item 1). Neither is written as the other's negation. The test filters a two-model list
  through both, reads `expected` off the narrowed save arm without a cast, and checks the external
  arm has no such own property.

No generic conflict component was written; none exists in this phase.

### 1.3 The per-file automatic-reload guard predicate (entries 15 and 32)

`decideAutomaticReload(inputs)` in `observationDelivery.ts` takes three per-file facts —
`uncertaintyUnresolved`, `observationRetained`, `surfaceOpen` — and answers `permitted` only when all
three are `false`, otherwise `refused` with the **first** reason in that order. The order is the
strength of the claim: an unknown write outcome is the one state under which even an empty registry
may not reread (entry 15), so it is never masked by a weaker refusal. All three inputs are read once
before any comparison. The doc states, in the same paragraph as what it enforces, what it cannot: that
the inputs are current (entry 32's *recheck immediately before installation* is the caller's,
`rereadUnderGuard`'s guard), and that `surfaceOpen` was answered from the registry rather than from a
mounted panel. The eight-row truth table, the precedence, the read-once discipline and the ruling's
named negative case (`uncertaintyUnresolved: true, surfaceOpen: false` → refused) are each a test.

The state that feeds it is 2d-6-1b's; the guarded request that asks it is 2d-6-1c's.

### 1.4 Origin-correct message values and EN/ES sentences (entries 13, 14, 24, 39, 40)

**`describeExternalConflict` no longer emits `changedElsewhere`.** `ExternalConflictMessage`
(`saveOutcome.ts`) has one arm, `fileChangedWhileOpen`, keyed to
`browser.externalConflict.fileChangedWhileOpen`; `ConflictMessage = SaveOutcomeMessage |
ExternalConflictMessage`; `conflictMessageKey()` narrows on the external literal and delegates the
rest to `saveOutcomeMessageKey()`. `messages` moved from `ConflictModelCommon` onto each arm —
`SaveConflictModel.messages: readonly SaveOutcomeMessage[]` (unchanged type, so the seven surface
views that spread `outcome.messages` and the eight components that draw them through
`tSaveOutcomeMessage` are untouched) and `ExternalConflictModel.messages: readonly ConflictMessage[]`.
The acceptance test drives every one of the eight surface declarations (the seven
`CONFLICT_CAPABILITIES` plus `RECOVERY_CONFLICT_CAPABILITIES`) against four observation shapes, through
both `describeExternalConflict` and `supersedeConflict`, and asserts `changedElsewhere` is absent and
`fileChangedWhileOpen` is first.

**New keys, both dictionaries**, all under `browser.externalConflict.*` (entry 39; nothing under
`code.*`, no concatenated key, every selection a `switch` with a `never` terminus):

| Key | Entry | Value type |
|---|---|---|
| `browser.externalConflict.fileChangedWhileOpen` | 24 | `ExternalConflictMessage` |
| `browser.externalConflict.observationRetained` | 13 | `ExternalConflictNotice` |
| `browser.externalConflict.writeOutcomeUnknown` | 14 | `ExternalConflictNotice` |
| `browser.externalConflict.action.acknowledgeSnapshot` | 14 | `ExternalConflictAction` |

**Accessors** (entry 39): `describeConflictMessage`, `describeExternalConflictNotice` and
`describeExternalConflictAction` in `codes.ts` — a new, delimited section with a header paragraph
saying why frontend state lives in a file about Rust codes and that the Rust contract does not see it —
and `tConflictMessage`, `tExternalConflictNotice`, `tExternalConflictAction` in `index.ts`. The key
functions stay beside the types in `src/lib/browser/`. `codes.ts` now imports two browser modules at
run time; no browser module imports `../i18n` at run time, so there is no cycle.

**Entry 24's three corrections, in both dictionaries:**

1. `browser.conflictOrigin.changedWhileOpen`: *"No save was attempted, so nothing was written from
   here in response to that change"* → *"No save was initiated in response to this observation, so
   nothing was written from here in response to it"*.
2. The three `browser.reapply.externalEvidence.*` refusals end *"This reapply attempt wrote nothing."*
   instead of *"Nothing was written."* The consult's evidence names line 152 (`noCorrespondence`); the
   two siblings are the same sentence on the same `tExternalEvidenceRefusal` path and were corrected
   with it so one accessor does not answer two registers. See §5 for the reapply sentences left alone.
3. `browser.reapply.supersededConflict`: *"This file changed again after the version shown here was
   read…"* → *"The evidence this panel was comparing against has been superseded by another accepted
   reading of this file…"* — accepted evidence changed, no chronology claimed.

**Entry 40**: `externalConflictCodes.test.ts` pins the retained sentence, the uncertainty sentence and
its label, the two external-origin lines, the three reapply endings and the supersession sentence
**literally in EN and ES**, and scans all nine bounded keys in both locales for the forbidden claims
(*merged, saved, newer, deleted, exact duplicate, identity correspondence*, plus *automatically* and
*your save*), with a control case that keeps each list capable of firing. The file's header and the
suite's leading comment say what the fixtures are: approved wording, not meaning, not translation
quality — the Spanish is the implementer's draft and has not had a bilingual review.

The action label is *"I have reviewed this snapshot"* without the consult's trailing full stop, to
match every other control label in the dictionaries (none ends in a period).

## 2. Entry 41 corrections made in this diff

| File | Sentence falsified | Correction |
|---|---|---|
| `conflictSource.ts`, `ConflictOriginMessage.changedWhileOpen` | "with no save attempted" | "no save was initiated in response to that observation", with the barrier-release reason |
| `conflictSource.ts`, `ObservationVerdict.retained` | "which only a later settlement does" | names today's two releases (settlement, `open()`), states nothing schedules a second look, and records that §5.6 binds the person-requested retry to 2d-6-1b — a record reference, not a claim the path exists |
| `saveOutcome.ts`, `ExternalConflictModel` header | "**no write was attempted**"; "Nothing in production builds one yet … arbitration … is 2d-5-5b's" | "no save was initiated in response to that observation"; the producer still has only test callers, `observeExternalChange` exists and registers but delivers nothing, the calling transition is 2d-6-2's |
| `saveOutcome.ts`, `ConflictModelCommon.diskText` | "because nothing was attempted and nothing refused it" | "because no save was initiated in response to the observation, so nothing refused one" |
| `saveOutcome.ts`, `describeExternalConflict` doc | "nothing was attempted"; "and no save was made" | narrowed to the observation; the `nothingWasWritten` omission now also cites the unbounded-claim reason |
| `saveOutcome.ts`, module header | accessor list | adds `tConflictMessage` |
| `index.ts`, `describeSupersededEvidence` / `tSupersededEvidence` | "replaced by a later reading" | "superseded by another accepted reading", with the chronology limit stated |
| `conflictSource.test.ts` | the case pinning "no save was attempted" | pins the new clause and the absence of the old one |

Not corrected, deliberately, because their modules were not otherwise changed and entry 41 makes that
a permission rather than an obligation (§6 item 3): the "exactly two" uncertainty-exit sentences in
`workspace.svelte.ts` and `2d-5-5b-notes.md` (2d-6-1b adds the third exit and touches that module);
"Today every registered transition is a no-op" in `observationTransitions.ts:580` (2d-6-2's);
"no save was attempted" at `reapply.ts:229`, which is a true statement about the reapply path itself
(a reapply makes no save) rather than the external-origin claim entry 24 narrows.

## 3. Counts, measured

**Vitest: 2474 → 2520 passed, 62 → 64 files.** The before figure was measured on the untouched tree at
the start of the phase (`/tmp/2d-6-1a-vitest-before.txt`); the per-file *after* figures below were
measured with the JSON reporter and `rg -c "^\s*it\('"`, and the per-file *before* figures are those
minus the cases this diff added, which the last row checks against the total:

| File | Δ | How |
|---|---|---|
| `src/lib/browser/observationDelivery.test.ts` (new) | +14 | 14 `it(` |
| `src/lib/i18n/externalConflictCodes.test.ts` (new) | +21 | 15 `it(` + 3 `it.each(LOCALES)` × 2 (after the review: three cases replaced one) |
| `src/lib/browser/conflictSource.test.ts` | +4 | the *revisions one conflict may name* suite (23 → 27) |
| `src/lib/browser/saveOutcome.test.ts` | +4 | the acceptance case, the namespace case, the type-guard case, and — after the review — the tuple's compile-time refusal case (67 → 71) |
| `scripts/lint/ipc-detail.test.ts` | +3 | one row per new `.ts` file under `src/` (138 → 141) |
| **Total** | **+46** | 14 + 21 + 4 + 4 + 3 = 46 ✓ |

**Vite: 191 → 192 modules** (with the instrument in the tree; 190 → 191 normalized). The one new
reachable module is `src/lib/browser/observationDelivery.ts`, reached through `codes.ts` → `index.ts`
→ the entry. The two test files cost nothing. The bundle oracle read both lines: the server-only
pattern is absent (`rg -c` prints nothing) and the client-only pattern is present (2).

**svelte-check: 444 → 447 files, 0 errors, 0 warnings.** The baseline is the rung's 444; all three new
`.ts` files are under `tsconfig.json`, so the increase is the production module plus both test files.
(A first draft of this record wrote 445 → 447 — the 445 was a mid-phase reading taken after the
production module existed and before the tests did; the review caught it.)

## 4. Verification

Run from the repository root on the final tree, after the working tree was restored (§6):

| Command | Exit | Evidence |
|---|---|---|
| `npm run check` | 0 | `/tmp/2d-6-1a-check.txt` — 447 files, 0 errors, 0 warnings |
| `npm test` | 0 | `/tmp/2d-6-1a-vitest.txt` — 2520 passed, 64 files |
| `npm run build` | 0 | `/tmp/2d-6-1a-build.txt` — 192 modules transformed |
| Cargo | not run | no file under `src-tauri/` or `crates/` changed; `dictionary_contract.rs:91` confirms the Rust contract compares the `code.` namespace alone, so `browser.externalConflict.*` is outside it |

`git status --short` and `git diff --stat` were the only git commands this phase was meant to run; see
§6 for the one it ran by mistake.

## 5. Open items noticed and left, deliberately

1. **`browser.reapply.manualResolution`, `adoptionRefused`, `unavailable` and `notAttempted` still
   say *"Nothing was written"* / *"nothing was written"*.** They are reapply refusals too, and after an
   uncertain write the unbounded form is as overbroad there as on the three external-evidence
   sentences. The consult's evidence names lines 152, 155 and 199 and this phase corrected those and
   the two `externalEvidence` siblings; the four umbrella sentences are 2d-6-2's (the reapply step) to
   take with the register review that step owes. `index.ts:1354` ("`manualResolution` says only that
   nothing was applied, written or moved") goes with them.
2. **`SaveOutcomeMessage`'s doc says "Nine codes"** and `tSaveOutcomeMessage`'s says "none of these
   nine sentences"; there are thirteen. Stale before this phase and not falsified by it.
3. **`ExternalConflictAction` has one arm.** If 2d-6-9 adds the retry control's label it belongs in
   this union, not as a bare key constant, so the `switch` grows a case rather than a component
   concatenating a key.
4. **No `browser.reconciliation.*` key was needed** by this phase: the guard's refusal reasons are
   decisions, not sentences, and the record's §6 item 4 leaves which states carry a display operand to
   2d-6-9.
5. **The Spanish of the nine bounded sentences has not had a bilingual review** — the fixtures say so.
   The phase's review is where a bilingual reader corrects them; the correction is one deliberate edit
   to `es.json` and `externalConflictCodes.test.ts` together.

## 6. One procedural fault, recorded rather than hidden

While re-deriving per-file test counts, a Bash call of mine included `git stash -q` by mistake, which
stashed every tracked modification — this phase's and the two instrument paths. It was noticed on the
next tool result and reversed immediately with `git stash pop`; `git stash list` is empty and
`git diff --stat -- src-tauri/src/main.rs src/main.ts` reads `5 insertions(+), 1 deletion(-)`, the
figure `PROGRESS.md` requires. Nothing was committed, reverted or staged, and the untracked files were
never touched (a plain `stash` does not take them). The gates were run once more after the pop.

## 7. Review

**Codex adversarial review, ship-with-fixes: 0 blockers, 3 SHOULD-FIX**
([`docs/reviews/phase-2d-6-1a.md`](../reviews/phase-2d-6-1a.md)). Each was re-derived on the tree before
it was fixed; all three held.

1. **`externalConflictCodes.test.ts` — the Spanish scan had no affirmative *saved* form.** Held:
   "El archivo se ha guardado." prepended to a refusal passed. The scan is now a table of
   `{ claim, form, control }` per locale — `form` a Unicode-bounded pattern, and the two participle
   forms (`guardado`, `(se) ha escrito` / `was written`) exclude exactly the approved negative wording
   by lookbehind (*ningún*, *no (se)*, *nothing*). Three cases replaced the single control: every
   form catches its own positive control (10 per locale, so no pattern is vacuous); the reviewer's
   probe and its *written* twin are caught on every bounded key in both languages; and the approved
   negative clauses, quoted from the bounded sentences, pass every form.
2. **`saveOutcome.ts:1248` — the comment claimed a guarantee `ConflictMessage[]` did not give.** Held.
   Fixed by narrowing rather than by rewording alone: `ExternalConflictModel.messages` is now
   `ExternalConflictMessages = readonly [ExternalConflictMessage, ...SaveOutcomeMessage[]]`, so a
   save-outcome code in position 0 is a compile error in the producer (pinned by a `@ts-expect-error`
   case); the type, the field doc, the producer doc and the inline comment all say that positions 1
   onward are `SaveOutcomeMessage` and that the absence of `changedElsewhere` there rests on the
   producer plus the run-time test, not on the type. Every existing reader compiles unchanged: nothing
   in production reads the external list, the save arm's list is untouched, and iterating the tuple
   still yields `ConflictMessage` for `tConflictMessage`.
3. **This record §3 — the svelte-check decomposition.** Held: the rung's baseline is 444, and all
   three new `.ts` files are under `tsconfig.json`. Corrected to 444 → 447, attributed to the
   production module plus both test files.

After the fixes: `npm run check` exit 0 (447 files, 0 errors, 0 warnings); `npm test` exit 0
(2520 passed, 64 files). No `.svelte`, no Rust, no `BrowserState` member changed by the fixes.
