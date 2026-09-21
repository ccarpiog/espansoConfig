# Phase 2d-5-5a — the `ConflictSource` origin union, the six registrations, and origin-switched reapply evidence

**Status: implemented, gates green.** Risk class: **high** — it re-types the value every conflict
panel in the application is built around. Components: **none**. No `.svelte` file is touched, and
that was a constraint rather than an outcome: §5 below records the one design decision that was taken
*because* keeping it true was mandatory.

This is the first half of step 5 of the design consult
([`docs/reviews/phase-2d-5-design.md`](../reviews/phase-2d-5-design.md)), split by the orchestrator
into **2d-5-5a** (this phase) and **2d-5-5b**. Binding rulings **21, 22, 23 and 24** of
[`2d-5-split-notes.md`](2d-5-split-notes.md) §3 are this phase's. Rulings **25, 26 and 27** —
same-revision coalescing, different-revision supersession and the per-document in-flight-write
barrier — are **explicitly not**, and nothing below arbitrates between a save conflict and a watcher
observation or gates an observation on an in-flight write.

---

## 1. What was already there, and what this phase added

**Phase 2d-5-1 had already built the vocabulary.** `src/lib/browser/conflictSource.ts` shipped
`ExternalConflictObservation`, the `ConflictSource` union, both memos and the two origin lines with
their English and Spanish keys, and its own header said in as many words that **no production caller
read a `ConflictSource` yet**. 2d-5-4 shipped `externalConflictObservationOf`
(`src/lib/browser/observationTransitions.ts:508`), the only producer of a narrowed observation.

So this phase did not invent the union; it **wired it**, and the work was:

1. `ConflictModel.source` re-typed from the wire `ConflictResult` to `ConflictSource`, with the model
   split into two arms so the save-only fields have somewhere honest to live (ruling 21).
2. Every `rememberTheConflict` caller routed through the memoized save source, and both
   identity-keyed maps re-keyed to `ConflictSource` (ruling 22).
3. A registration door for the external origin, without which its adoption outcomes could not exist
   at all (§4).
4. `reapplyEvidenceFor`, the origin switch, with the two-revision gate on external correspondence
   (rulings 23 and 24).
5. Three new user-facing codes with English and Spanish keys and a typed accessor.

---

## 2. The rulings, and how each is discharged

### Ruling 21 — a discriminated `ConflictSource`, never a structurally widened save type

`ConflictSource` was a bare union; it is now the union of two **named** interfaces,
`SaveConflictSource` (`src/lib/browser/conflictSource.ts:144`) and `ExternalChangeConflictSource`
(`:158`), with `ConflictSource` at `:133`. The naming is not tidiness: it is what lets a *model* type
demand one arm.

`ConflictModel<T>` (`src/lib/browser/saveOutcome.ts:886`) is now
`SaveConflictModel<T> | ExternalConflictModel<T>`. The fields both origins really share live once, in
the unexported `ConflictModelCommon<T>` (`:734`-`:789`). `SaveConflictModel` (`:810`) carries
`source: SaveConflictSource` **and** `expected`, `found` and `changedAgain` as **required** fields;
`ExternalConflictModel` (`:863`) carries `source: ExternalChangeConflictSource` and none of the three.

**No optional top-level `expected` / `found` / `changedAgain` survives**, which is the acceptance
criterion read literally: they are required on one arm and absent from the other, so reading one off
an external conflict is a compile error rather than an `undefined`.

**What the types force, and what they do not, in the same sentence** — corrected after this phase's
review, whose finding 3 was that the first half of this paragraph claimed more than TypeScript gives.
What they force is that `expected` is **inaccessible**: reading it off an `ExternalConflictModel`, or
off the union, is a compile error, and a consumer holding the union cannot read it without narrowing.
What they do **not** force is that the property be *absent* from such a value. Excess-property
checking rejects it in exactly one position — a fresh object literal annotated with the arm itself —
and accepts it in two that a caller can reach without a cast: the same literal annotated with the
**union** (excess-property checking against a union target admits any property declared on any arm,
and `expected` is declared on the save arm), and any non-fresh variable assigned to the arm, which is
plain structural subtyping. Both were measured with this repository's TypeScript (6.0.3) and compiler
options. The consequence is bounded rather than nil: such a value carries a field **nothing can read
through either type**, so it cannot make an external conflict masquerade as a save one at any use
site — but the record may not say the field cannot be there. Making the absence structural would take
`expected?: never` on the external arm, which is machinery added to make a sentence true and was not
taken; the sentence was corrected instead.

They also do **not** force narrowing to happen through any particular
predicate — the discriminant is nested (`source.kind`), and TypeScript narrows a *property* access,
not the object that holds it, so a consumer that needs one arm's fields either narrows by hand or
takes the arm's type directly. `beginReapply` takes the arm's type directly; nothing forces a future
consumer to do either.

### Ruling 22 — the memoized save source, and both maps re-keyed

`describeConflict` (`src/lib/browser/saveOutcome.ts:1019`) now writes
`source: saveConflictSource(result)` rather than `source: result`. That is the single place the save
arm is built, so **all six registration sites inherit the memo through the model** — and each of the
six also calls the memo itself, because it registers the origin before any model exists:

| Writer | Site |
|---|---|
| `moveMatch` | `src/lib/browser/workspace.svelte.ts:4059` |
| `saveMatch` | `src/lib/browser/workspace.svelte.ts:4151` |
| `createMatch` | `src/lib/browser/workspace.svelte.ts:4228` |
| `deleteMatch` | `src/lib/browser/workspace.svelte.ts:4288` |
| `duplicateMatch` | `src/lib/browser/workspace.svelte.ts:4411` |
| `saveRawDocument` | `src/lib/browser/workspace.svelte.ts:4493` |

`rememberTheConflict` (`:2694`) takes a `ConflictSource` rather than a `ConflictResult`, so one
function serves both origins. `conflictOrigins` (`:2233`) is
`WeakMap<ConflictSource, { document, generation }>`, and the reapply authorization memo
(`src/lib/browser/saveOutcome.ts:1543`) is `WeakMap<ConflictSource, ReloadConfirmation>`.

**The honest half is written into the code, not only here.** The declaration comment at
`workspace.svelte.ts:2214`-`:2221` and `rememberTheConflict`'s own doc both say that **nothing forces
a caller through the memo**: a hand-built wrapper of the same shape type-checks, is a different
object, is in no map, and therefore installs nothing. That **fails safe, and silently** — a refused
adoption with no word about why. `describeConflict`'s inline comment says the same at the one place a
literal would be easiest to write.

**One origin, one registration, and the first is the one that counts** — added answering this phase's
review (finding 1; §9). `rememberTheConflict` returns without writing when `conflictOrigins` already
holds the origin, because both memos answer **one object per wire refusal and per observation**: a
second registration of one conflict therefore lands on the first one's key, and overwriting it would
put *today's* projection generation where the generation the conflict really arrived at was — the
exact fact `adoptDiskVersion` refuses a backwards install by. The whole entry stands rather than being
merged, so a re-registration cannot re-point an origin at another file either. What is unchanged is
that a **different** origin object gets its own entry: two narrowings of one wire snapshot are still
two keys.

The substitution is lossless for the save origin *because* the memo is keyed on the wire value, so a
second description of one refusal recovers the same origin object and therefore the same map entry
and the same token. That is the property the 2c-4b-2 review found unguarded, and it is now pinned
twice: `saveOutcome.test.ts:584` (reference equality of the origin across two descriptions) and the
pre-existing `reapply.test.ts:430` (one token across two descriptions).

### Ruling 23 — what origin may change, and what it may not

**May change.** The messages: `describeExternalConflict` (`src/lib/browser/saveOutcome.ts:1111`)
builds three lines, not five. `nothingWasWritten` is **left out**, because *nothing was written* would
be read as *your save wrote nothing* and there was no save; `changedAgainSinceRefusal` is left out
because there is no refusal for anything to have changed again since. What did and did not happen is
the origin line's — `conflictOriginMessage`, whose `changedWhileOpen` sentence already says *no save
was attempted, so nothing was written from here in response to that change* in both dictionaries
(`src/lib/i18n/en.json:198`, `src/lib/i18n/es.json:198`). Whether expected/found exist: they do not,
by type. The provenance of reapply evidence: ruling 24 below.

**May not change.** All three are pinned:

- **`adoptDiskVersion` stays the only confirmed-install door with its three answers.** Its body is
  unchanged except for the type of the value it looks up; `workspace.test.ts:6582` drives
  `installed`, then `refused` (one token, one install) and then `alreadyThere` for an
  **external-origin** model, and asserts the window really moved on the first.
  `workspace.test.ts:6553` pins `refused` for an external conflict this state never registered and
  `:6606` for a model built from a structurally equal but distinct observation.
  `workspace.test.ts:6565` pins that the registration **installs nothing**.
- **`conflictChoicesFor` stays the only producer of a choice list.** It takes the surface's
  declaration and the reload step and cannot be told which origin is showing, so it is origin-blind by
  construction; `saveOutcome.test.ts:669` pins that neither origin's model carries a choice list of
  its own for a renderer to prefer — the second-answer defect the field it replaced once was.
- **The surface's declared capabilities are unchanged.** `ConflictCapabilities` is untouched, and
  `saveOutcome.test.ts:643` shows the same two declarations choosing both of an external conflict's
  own lines: the raw editor's reload still reseeds its draft, the mover's still abandons an operation.

### Ruling 24 — external evidence is usable only when both revisions match

`reapplyEvidenceFor` (`src/lib/browser/reapply.ts:434`) is the origin switch, with a `never` terminus.
For `save` it answers `saveEvidence` carrying `ConflictResult.reapply`, read through the one accessor
`saveReapplyEvidence` (`:333`) so the payload is reached in exactly one place. For `externalChange` it
refuses a null table (`noCorrespondence`), refuses a `base_revision` that is not the retained draft's
base (`baseRevisionMoved`), refuses a `disk_revision` that is not the conflict's disk observation
(`diskRevisionMoved`), and otherwise answers `externalCorrespondence` with **a frozen snapshot it
built from the values it compared** — not the observation's table by identity. That last clause was
the review's finding 2 and is §9's; the text above it describes the function as it now stands.

**Both operands come off the conflict** — `conflict.draft.baseRevision` and `conflict.diskRevision` —
so no caller can supply a mismatched pair. That is deliberate and is the strongest thing available
here.

**What the equalities establish, and what they do not, in the same sentence** — written into the
function's own doc and not only here. They establish that the table *names* the two snapshots this
conflict names. They do **not** establish that one Rust call built both, which is the only thing that
would make the rows trustworthy; `src/lib/ipc/types.ts:2891-2911` says the table is snapshot-bound and
that TypeScript does not express the pairing, and what the pairing rests on is that
`externalConflictObservationOf` narrowed **one** wire snapshot. A caller that reads
`observation.correspondences` directly rather than through this function gets no check at all, and
`conflictSource.ts:107`-`:112` now says so where the field is declared.

Pinned at `reapply.test.ts:293` (save arm), `:303`, `:312`, `:323` (the three refusals), `:333`
(accepted when both match, and what comes back equals the table without being it) and `:354` (the
revisions it compared are the ones it answers with, whatever a later read says).

---

## 3. Origin-specific messages, and where the accessor lives

`browser.conflictOrigin.refusedSave` and `browser.conflictOrigin.changedWhileOpen` already existed
with a typed accessor `tConflictOriginMessage` (`src/lib/i18n/index.ts:825`), shipped by 2d-5-1, and
they already say exactly what ruling 23 permits each origin to say. Nothing about them needed
changing, and this phase added no fourth origin line.

**Three new codes were added**, for the evidence refusals a panel will have to explain:
`browser.reapply.externalEvidence.{noCorrespondence,baseRevisionMoved,diskRevisionMoved}` in
`src/lib/i18n/en.json:152-154` and `src/lib/i18n/es.json:152-154`, with `externalEvidenceRefusalKey`
(`src/lib/browser/reapply.ts:502`) and the accessors `describeExternalEvidenceRefusal` /
`tExternalEvidenceRefusal` (`src/lib/i18n/index.ts:1422`, `:1436`). None carries an operand, and none
names a revision: a content revision is a hex digest, and showing one beside a refusal would invite a
person to compare two strings that carry no order.

**A deviation from the brief's wording, stated rather than glossed.** The brief asks for typed
accessors "in `src/lib/i18n/codes.ts`". That file is for **wire enums** — its
`CODE_NAMESPACE_KEY_BUILDERS` registry is about the `code.` namespace and is asserted exactly in both
directions by `codes.test.ts`. Every accessor over a **browser model's** own codes lives in
`src/lib/i18n/index.ts` (`tSaveOutcomeMessage`, `tReapplyOutcome`, `tConflictOriginMessage`), and the
new ones follow that convention. Putting them in `codes.ts` would have made them the one pair of
browser-model accessors in the wire-enum file.

**What no test in this repository can hold about any of the six sentences**: that they say what the
ruling requires. The i18n suites check key parity and placeholder agreement and never meaning
(`CLAUDE.md` §2). `reapply.test.ts:392` pins that each refusal reaches a **distinct** entry both
dictionaries really hold, and that the accessor resolves — never that either sentence is true.

---

## 4. Two additions the acceptance criteria required, and the argument for each

Both are surface area the brief did not name in so many words, and both are load-bearing for a stated
criterion. Neither arbitrates anything.

**`describeExternalConflict` (`src/lib/browser/saveOutcome.ts:1111`).** `ExternalConflictModel` needs
a producer, or the only way to obtain one is a hand-written object literal — exactly the
"assembled from loose fields" shape `ConflictModel.source` exists to prevent. It is the external
origin's only producer; its production callers arrive with 2d-5-5b and 2d-6, and its doc says so.

**`BrowserState.rememberExternalConflict` (`src/lib/browser/workspace.svelte.ts:1190`, implemented at
`:3596`).** The criterion *"`adoptDiskVersion` still answers `installed | alreadyThere | refused` for
an external-origin model"* is unreachable without it: `adoptDiskVersion` looks the origin up in this
state's own map, and an origin no `BrowserState` ever registered can only ever be `refused`. It is the
same door — it calls the same private `rememberTheConflict` — and it installs nothing. The file it
registers against is **read off the observation**, never taken as a second argument, so an observation
of one file cannot be registered against another. The caller-controlled `document` read is taken first
and once, in the same idiom `adoptDiskVersion` uses.

---

## 5. The one design decision the "no components" constraint forced

The obvious reading of ruling 21 — one `ConflictModel` interface with `source: ConflictSource` and the
three save-only fields moved out entirely — **breaks eight components**, which read `conflict.expected`
and `conflict.found` off a narrowed `SaveOutcomeModel` (`MatchEditor`, `MatchCreator`, `MatchMover`,
`MatchDeleter`, `MatchDuplicator`, `RawEditor`, `RestorePane`, `RecoveryPanel`).

The reading taken instead keeps both constraints: **`SaveOutcomeModel<T>`'s conflict arm is
`SaveConflictModel<T>`, not the union** (`src/lib/browser/saveOutcome.ts:901`). That is not a dodge,
it is the truthful statement: the only two producers of a `SaveOutcomeModel` are `describeEditSave`
and `describeWholeDocumentSave`, both of which take a save's own result, so a save outcome's conflict
can only ever have come from a refused write attempt. Widening that arm would have said something
false about provenance *and* taken `expected` and `found` away from eight panels.

The consequence is a set of **eight return-type narrowings**, mechanical and each truthful today:
`conflictArm` (`src/lib/browser/editorSave.ts:233`) and the seven `conflictOf`-shaped accessors in
`matchEditor.ts`, `matchMove.ts`, `matchCreation.ts`, `matchDeletion.ts`, `matchDuplication.ts`,
`rawEditor.ts`, `restore.ts` and `recovery.ts` now answer `SaveConflictModel<…> | null`. The **view**
interfaces those feed still declare `ConflictModel<…> | null`, so the panels' props are already the
union and 2d-6 widens the accessors rather than the props.

`beginReapply` (`src/lib/browser/reapply.ts:309`) takes `SaveConflictModel<T> | null` for the same
reason, and its doc states the argument: every one of `ReapplyStart`'s arms is a sentence about a
save. `ready` hands back a `ReapplyEvidence` — the subject and placement one refused *operation* was
resolved for — and an external change resolves no operation at all; `unavailable` says *this surface
can never reapply* and `notAttempted` says *there was no conflict*, and both would be false of an
external conflict. Rather than reuse a false arm or invent 2d-6's panel vocabulary, the **compiler**
refuses one there and `reapplyEvidenceFor` is where that origin's evidence is read. What that does not
force is stated in the same doc: nothing stops a later caller widening the parameter back, and what
would then be needed is a new arm, not a reused one.

`RecoveryOrigin.conflict` (`src/lib/browser/recovery.ts:832`) widened from `ConflictResult` to
`ConflictSource` for the opposite reason: the field exists for **identity**, and the identity a window
registers is now the origin, so carrying the payload would have been carrying something no map is
keyed by. The wire value is still reachable through the `save` arm.

---

## 6. Records corrected rather than appended to

Four comments claimed a state the tree no longer holds, and each was **edited in place**:

- `src/lib/browser/conflictSource.ts`'s header said no production caller read a `ConflictSource`; it
  now names the three that do and names what still has none.
- `saveConflictSource`'s doc said the maps "go on working when `ConflictModel.source` widens at
  2d-5-5"; it now says they do, and names both maps and their files correctly (the reapply memo is in
  `saveOutcome.ts`, not `workspace.svelte.ts`).
- `src/lib/browser/conflictSource.test.ts`'s header said nothing in the repository consumes
  `ConflictSource`.
- Two test comments called `ConflictModel.source` "the wire value"
  (`reapply.test.ts:431`, `workspace.test.ts:6998`).

`ExternalConflictObservation.correspondences` said the two-revision check "is 2d-5-5's, and this
comment is the whole of what carries the obligation until then"; it now names
`reapplyEvidenceFor` as the one function that performs it, and says that a caller reading the field
directly gets no check.

---

## 7. Verification

Every command run on its own, on the final tree, with nothing run concurrently with `cargo`. The
figures below are the **post-review** tree's — §9's four fixes are in them.

| Gate | Command | Result |
|---|---|---|
| Rust tests | `cargo test --workspace -- --test-threads=1` | exit 0 — **1320** over **26** `test result` lines |
| Clippy | `cargo clippy --workspace --all-targets -- -D warnings` | exit 0 |
| Format | `cargo fmt --check` | exit 0 |
| Architecture | `cargo tree -p espansoconfig-core \| rg tauri` | finds nothing (exit 1, no output) |
| svelte-check | `npm run check` | exit 0 — **443 files, 0 errors, 0 warnings** |
| vitest | `npm test` | exit 0 — **2433 passed in 61 files** |
| Vite | `npm run build` | exit 0 — **189 modules** |

**Both complementary questions were asked of the Rust gate**, not one: the sum over the 26
`test result` lines is 1320, **no line lacks `0 failed`**, and **no line lacks `0 filtered out`**.

**The three Rust rows were measured before the review's fixes and not re-measured after**, and the
reason is evidence rather than convenience: `git diff --numstat -- crates/ src-tauri/` names exactly
one path, the instrument's `src-tauri/src/main.rs`, which this phase never edited. No Rust source
changed, so no Rust figure can have moved; the architecture row was re-run anyway, because it costs
one command. The four frontend rows were all re-measured on the final tree.

**Both bundle oracles were read and both lines are reported.** Server-only markers
(`$$payload|head_payload|push_element`) — **absent**, `rg -c` produced no output. Client-only markers
(`window.__svelte|svelte-trusted-html`) — **present, 2**.

**The instrument pin holds**: `git diff --stat src-tauri/src/main.rs src/main.ts` is
`5 insertions(+), 1 deletion(-)`. Neither instrument path was edited, staged or reverted, and
`src-tauri/src/probe.rs` and `src/probe.ts` remain untracked.

### The four figures, and why three did not move

The rung was `1320 / 443 / 2415 / 189` at 2d-5-4-G and is **`1320 / 443 / 2433 / 189`**.

| Gate | Was | Now | Why |
|---|---|---|---|
| `cargo test` | 1320 | **1320** | no Rust source changed; the only tracked change under `src-tauri/` is the instrument's `main.rs` hook |
| `npm run check` files | 443 | **443** | **no module was added or removed** — every change is inside an existing file, and the new suites are cases in three existing test files |
| `npm test` | 2415 | **2433** | **+18, and each is a new case**: 6 in `saveOutcome.test.ts` (the two-origins suite), 6 in `reapply.test.ts` (the evidence suite) and 4 in `workspace.test.ts` (the external-origin adoption cases) were this phase's; **+2 more are §9's regressions** — one in `reapply.test.ts` (finding 2's captured-operand case) and one in `workspace.test.ts` (finding 1's second-registration case). The two findings that were sentences added no case, because a sentence is not executable |
| `npm run build` modules | 189 | **189** | no new `.ts` module and no new styled component |

### What no gate could catch

No gate fails for a *sentence*. The three new dictionary entries, the six corrected comments and
every "what this does not force" clause in this record are checked by nothing executable; the defence
is the same one `CLAUDE.md` §5 names — each is derived from the code here, so a reader checks the
record against the code.

Nor does any gate reach the external origin's **production** path, because there is none yet: every
external-origin case in this phase constructs its own observation and its own model. That is not a
coverage hole that closes here — 2d-5-5b is what gives `WriteSurfaceTransition` a real body.

---

## 8. Where it is thin

No item below names an unfixed correctness defect in a source file, so none holds this step open.

1. **The `ConflictModel` discriminant is nested, and TypeScript does not narrow the parent from
   it.** `if (model.source.kind === 'save')` narrows `model.source` and leaves `model` the union, so a
   consumer that wants `expected` must take `SaveConflictModel` as its parameter type (what
   `beginReapply` does) or write its own predicate. A top-level `origin: 'save' | 'externalChange'`
   would narrow, and was rejected: two discriminants can disagree, and a record claiming a guarantee
   the code does not give is this project's worst defect class. **The consequence is real** — the
   first consumer that needs both arms' fields in one function will have to write a type predicate,
   and there is none in the repository to copy.

2. **`beginReapply`'s restriction is a parameter type, and 2d-6 will have to undo it deliberately.**
   When a surface can hold an external conflict, `conflictOf` widens back and `ReapplyStart` needs an
   arm carrying a `CorrespondenceTable` — which is **not** assignable to any `ReapplyOutcome` arm, so
   the six surfaces' `if (start.kind !== 'ready') return start;` will stop compiling and each will
   have to decide what an external conflict's reapply means for it. That is the right place for the
   decision and the wrong place for a silent default; it is named here so the breakage is expected
   rather than discovered.

3. **`reapplyEvidenceFor`'s accepted arm hands back a table nothing yet reads.** No surface consumes a
   `CorrespondenceTable`: the five match surfaces read `ReapplyEvidence`'s subject and placement, and
   turning a whole-file table into a subject needs the surface's own base `MatchId`, which the
   conflict model does not carry. Building that lookup is 2d-5-5b's or 2d-6's, and this phase
   deliberately did not guess its shape.

4. **`describeExternalConflict` and `rememberExternalConflict` have no production caller**, exactly as
   `conflictSource.ts` had none after 2d-5-1. Their doc comments say so rather than implying a wiring
   that does not exist. A gate cannot fail for an unused exported function, so only this record and
   those comments carry it.

5. **The three new dictionary entries are drawn by nothing**, and `tExternalEvidenceRefusal`'s doc says
   so. A code with no string is worse than a code with no caller, which is why they exist now; that
   they say the right thing is unevidenced, as every sentence in this repository is.

6. **Two source items from `2d-5-4-G-notes.md` §9 were left alone** — the injected-property-read
   windows at `observationTransitions.ts` and `reconciliationCoordinator.ts`. `PROGRESS.md`'s open item
   0 says 2d-5-5 **may** take them if they fall naturally in its way; they did not. This phase changed
   neither module, so opening one to fix a window it did not touch would have been work outside the
   phase's own diff. They stay where `PROGRESS.md` has them.

7. **`externalConflictSource`'s memo is keyed on the observation object, and two narrowings of one
   wire snapshot are two observations.** `workspace.test.ts:6606` pins the consequence — a model built
   from an equal but distinct observation installs nothing — and it is the same object-identity bound
   `saveConflictSource` has always had. Whether the coalescing 2d-5-5b builds re-narrows an observation
   it has already seen is that step's question, and getting it wrong shows up as a refused adoption
   rather than a wrong one.

8. **The eight narrowed accessors are truthful today and are not enforced to stay so.** Nothing stops
   a future author assigning an external conflict into a session's `outcome` field; what would stop
   compiling is the assignment itself, because `SaveOutcomeModel`'s conflict arm is the save arm — but
   only while that stays true, and §5's argument for it is prose in a doc comment, not a test.

*Items 9 to 11 were noticed while answering the review (§9) and deliberately **not** fixed there: a
fix answers the findings the review named, in the files it named (`CLAUDE.md` §7). Each is here for a
later phase to take deliberately.*

9. **The save arm still hands its evidence back by identity.** `saveReapplyEvidence`
   (`src/lib/browser/reapply.ts:333`) answers `source.conflict.reapply` — the wire payload's own
   object — and `beginReapply`'s `ready` arm carries the same value, so the external arm is now
   snapshot-bound (finding 2) while the save arm is not. The asymmetry is defensible today, because
   that payload is a `ConflictResult` the command layer handed over rather than a value a surface
   assembled, and it is the behaviour 2c-4b-2 shipped and five surfaces read; the review named only
   the external arm, so nothing here was changed. A later phase that wants one rule for both origins
   would snapshot `ReapplyEvidence` in that one accessor.

10. **The structural remedy for finding 3 was not taken.** `expected?: never` on
    `ExternalConflictModel` closes both positions excess-property checking leaves open — measured, not
    assumed — at the price of a field declared only to be impossible. It is machinery added to make a
    sentence true, which §2's own argument forbids, so the sentence was corrected instead. A phase
    that decides the union's write side must be structurally closed has the measurement to act on.

11. **First-registration-wins hands 2d-5-5b an obligation.** Now that re-registering one origin
    renews nothing, a coalescing pass that wants a *newer* generation for a file must register the
    **newer observation** — a different object, with its own entry — and must not expect a second call
    with the old one to refresh anything. Nothing in TypeScript says so; `rememberExternalConflict`'s
    doc does.

---

## 9. The review, and what each of its four findings became

The adversarial review of this phase's working tree is
[`docs/reviews/phase-2d-5-5a.md`](../reviews/phase-2d-5-5a.md), from the brief at
[`phase-2d-5-5a.brief.md`](../reviews/phase-2d-5-5a.brief.md). Its `VERDICT:` line is
**`ship-with-fixes`** — the reviewer's own summary paragraph above it says `needs-attention` and opens
with `do-not-ship`, and both are reported here rather than the kinder one alone: one blocker and three
should-fix, no file modified by the reviewer and no gate re-run by it. **Every one of the four was re-derived against this tree before it was touched, and all
four held.** Per `CLAUDE.md` §7 this is the fix round and the phase closes on it: nothing here is a
new phase, and what the fix noticed on the way is §8's items 9 to 11 rather than more changes.

### Finding 1 (blocker) — re-registering an observation revived a stale adoption

**Held.** `rememberExternalConflict` wraps the observation with the memo, so registering **one**
observation twice reached `rememberTheConflict` with the **same** origin object, and that function
wrote the entry unconditionally. The second write replaced the projection generation the conflict
arrived at with the current one, which is exactly what `adoptDiskVersion` compares to refuse an
install over a projection that has moved — so an outlived conflict got its authority back and
installed its older disk snapshot over a newer one, answering `installed` for moving the window
backwards.

**The fix** is in `rememberTheConflict` (`src/lib/browser/workspace.svelte.ts:2694`), the private
function both registration doors call and one level under the door the review anchored
(`rememberExternalConflict`): it returns without writing when `conflictOrigins` already
holds the origin, so the **first** registration is the only one and both halves of its entry stand.
`adoptDiskVersion` is untouched — it remains the only confirmed-install door with its
`installed | alreadyThere | refused` answers (ruling 23), and nothing about its validation was
weakened to make this true. The rule is written where it is forced, at `:2677`, and in the public
door's own doc at `:1171`.

**Pinned by** `workspace.test.ts:6617` — *does not renew a registration when one observation is
registered twice*: register, let a re-read install `rev-d`, register the **same** observation again,
adopt. Against the tree as the review found it that case failed with
`AssertionError: expected 'installed' to be 'refused'`.

### Finding 2 (should-fix) — evidence could change between the pairing checks and the return

**Held**, and it is this project's named check-and-spend class (`CLAUDE.md` §6). `reapplyEvidenceFor`
compared `correspondences.base_revision` and `correspondences.disk_revision` and then returned
`correspondences` — the observation's own table, a value a caller assembled. A property read runs
arbitrary code through a getter or a `Proxy` trap and `readonly` freezes nothing at runtime, so the
consumer's read of `base_revision` need not be the read the gate made, and the rows could be mutated
after the check.

**The fix** (`src/lib/browser/reapply.ts:434`): every operand — the table's two revisions and its
rows, the draft's base and the conflict's disk revision — is captured **once and before** any
comparison (`:444`), the comparisons are made on the captured values, and the accepted arm carries a
**frozen object this function built** from them, with the row array copied (`:471`). It is a shallow
snapshot and the comment says so in the same sentence: each row is still the observation's object, and
this function reads no field of any row.

**Pinned by** `reapply.test.ts:354` — *answers with the revisions it compared, whatever the table says
afterwards*, driving a `base_revision` getter that answers the matching revision once and `rev-z`
thereafter, plus a push into the row array after acceptance. Against the pre-fix return it failed with
`AssertionError: expected 'rev-z' to be 'rev-a'`. `:333` was adjusted in the same edit: it asserted the
table came back **by identity**, which the fix deliberately ends, and now asserts equality without
identity.

### Finding 3 (should-fix) — the record claimed structural exclusion TypeScript does not enforce

**Held.** §2's sentence said a value of `ExternalConflictModel` *cannot be given* an `expected`. A
compiler probe with this repository's TypeScript (6.0.3) and compiler options accepted two spellings
without a cast: an object literal carrying `expected` annotated with the **union** `ConflictModel<T>`,
and a non-fresh variable assigned to `ExternalConflictModel` itself. Only the fresh literal annotated
with the arm is rejected, by excess-property checking.

**The fix is the sentence**, not machinery: §2 now distinguishes the field being **inaccessible**
through both types — every read is a compile error, which the same probe confirmed for the arm, for
the union, and after nested-discriminant narrowing — from the property being **prohibited**, which it
is not. The structural remedy is measured and recorded in §8 item 10 rather than applied.

### Finding 4 (should-fix) — a comment claimed hand-built observations cannot adopt

**Held.** `describeExternalConflict`'s doc said a hand-built observation "is in no origin map and
therefore installs nothing". `BrowserState.rememberExternalConflict` is exported, takes any value of
`ExternalConflictObservation` and registers it, so a hand-built observation that has been registered
adopts exactly like any other.

**The fix is the sentence** (`src/lib/browser/saveOutcome.ts:1093`): it now says that an
**unregistered** observation is what installs nothing, that registration **trusts its caller** as the
six save registrations do, and that the map answers *did this state register this object* and never
*where did this object come from*. No provenance check was added; there is nothing in this layer that
could perform one.
