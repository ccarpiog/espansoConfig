# Phase 2d-6-7a — the owed obligations, then the operation panels' receivers registered

**Status: implemented, gates green, not yet reviewed.**
Risk class: **high** — the post-commit answer of four writing wrappers changes, the three operation
reapplies change their adoption order, and three more write surfaces now receive live deliveries.
**No new module, no new dictionary key, no Rust.** Components touched: `DetailPane.svelte` and,
mechanically, `MatchDeleter.svelte`, `MatchMover.svelte` and `MatchDuplicator.svelte` (one required
prop, one synchronous report, one withdrawal each).

This is the first of the three sub-phases 2d-6-7 was cut into
([`2d-6-split-notes.md`](2d-6-split-notes.md) §2, *The orchestrator's cut of 2d-6-7, taken
2026-09-23*, written by this phase). 7b's rendering and 7c's window reading are not done here.

Abbreviations: `W` is `src/lib/browser/workspace.svelte.ts`, `D` `matchDeletion.ts`, `M`
`matchMove.ts`, `U` `matchDuplication.ts`, `R` `surfaceReceivers.ts`, `DP`
`src/lib/components/DetailPane.svelte`. Line numbers are of the final tree unless marked *pre-fix*
(which are of `HEAD`, `136ea52`).

---

## 1. What changed

### 1.1 Owed item 1 — the post-commit shape of four wrappers (`2d-6-6c-2-notes.md` §5 items 2, 7)

**Audit result: all three operation wrappers had the defect, and `createMatch` had the unguarded
classification.** Pre-fix:

- `moveMatch` (*pre-fix* `W:6015-6033`), `deleteMatch` (*pre-fix* `W:6406-6413`) and `duplicateMatch`
  (*pre-fix* `W:6544-6561`) each recorded the commit with `write.expect(settlementOfOutcome(…))`, then
  awaited their adoption (`adoptTheDocumentOnDisk`, `adoptAfterTheDeletion`, `adoptAfterTheDuplicate`)
  and `readFileText()` **with no catch**. An exception out of either rejected the wrapper's promise,
  so the panel's `runDelete` / `runMove` / `runDuplicate` met a committed write as a rejection (D2).
- `createMatch` (*pre-fix* `W:6326`) had the catch, but classified inside it with a bare
  `classifyFailure(raw)`: a thrown value whose `code` getter throws escaped the catch and rejected a
  committed create — the exact shape 2d-6-6c-2's review fixed in `saveMatch`.

**Fix: one post-commit policy, `adoptAfterTheCommit` (`W:7323`)**, which all five match-level
wrappers now call (`saveMatch` `W:6153`, `createMatch` `W:6259`, `moveMatch` `W:6030`, `deleteMatch`
`W:6343`, `duplicateMatch` `W:6483`). It is `saveMatch`'s fixed block moved verbatim into a helper
that takes the wrapper's own adoption as a thunk: a `failed` adoption drops the replaced projection;
an exception before the adoption answered drops it too; one from the re-read keeps the new
projection; a failure the adoption already answered is kept; the classification runs in its own
`try` with the fixed-string fallback. `saveMatch`'s behaviour is unchanged (its four post-commit
cases pass untouched); it now shares the helper rather than holding a fifth copy. Ruling 1 below.

The `BrowserState.saveMatch` interface doc names the shared policy and the four other wrappers; the
`duplicateMatch` doc's "carried, not swallowed" paragraph says an exception is answered the same way.
Raw's wrapper (`saveRawDocument`) is 2d-6-8's and was not touched.

### 1.2 Owed item 2 — the three operation reapplies (`2d-6-6b-notes.md` §7 item 2)

**Audit result: all three had the blocker 2d-6-6b's review found in the authored reapplies, in both
halves, plus the missing post-adoption look 2d-6-6a had added there.** Pre-fix, in each of
`D:1828-1844`, `M:2793-2811` and `U:2093-2110` (*pre-fix*):

1. **Reads after the pre-adoption look.** `current()` was read once, then `installed.uncertaintyUnresolved`,
   `awaitedFor(installed)` (which reads `awaitingReconciliation` and `document`) and
   `conflictOf(installed)?.source` were read off it, and `adoptForReapply` then read the conflict's
   origin to mint the token — all caller-controlled, none followed by another look. A getter or
   `Proxy` trap there could install a new session and the reapply still adopted.
2. **No post-adoption look at all.** After `adopt` the rebuilt session was answered unconditionally,
   carrying `installed.awaitingReconciliation` read *after* the adoption. A delivery during the
   adoption that installed another conflict was answered `reapplied`, and the component installed a
   session rebuilt over it; a wait recorded during the adoption was dropped from the rebuilt session,
   so its ordinary send came back live.

**Fix: the editor's shape (`matchEditor.ts` `reapplyToDiskVersion`), copied into all three**
(`D:1798`, `M:2750`, `U:2062`):
- after the three facts, the authorization is minted with `reapplyAuthorizationFor` (imported from
  `./saveOutcome`, replacing `adoptForReapply`), then one last look (`D:1860`, `M:2825`, `U:2125`) —
  a displaced session is answered `supersededEvidence` and the window is not asked;
- `adopt(adopted, authorization)` is called with nothing caller-controlled in between;
- after it, `current()` again (`D:1870`, `M:2835`, `U:2135`): another conflict is answered
  `supersededEvidence`; otherwise the rebuilt session carries the **settled** session's waits;
- the answer is built, then a last look (`D:1882`, `M:2848`, `U:2147`); a displaced session is
  answered `supersededEvidence`.

Each reapply's JSDoc gained a paragraph saying what the looks bracket and what no type forces (that
the reader is honest); its "installed session's waits" clause now says the settled one's. Two
sentences this made false were corrected in place: `reapply.ts`'s header (item 3, and *"every reapply
transition … takes this route"*) and `saveOutcome.ts`'s `reapplyAuthorizationFor` doc, which both
said the match reapplies go through `adoptForReapply`. **`adoptForReapply` now has no production
caller**; it stays exported, and `reapply.test.ts` still drives it (§4 item 3).

### 1.3 Registration and delivery (`R`, `DP`, the three operation components)

- **`R`**: `ReceivingSurfaceKind` (`R:73`) gains `matchDeleter`, `matchMover`, `matchDuplicator`;
  `isReceivingKind` (`R:198`) is now an exhaustive `switch` with a `never` default, so a ninth
  `OpenWriteSurfaceKind` is a compile error there rather than a kind silently answered `false`. The
  module header, the kind's doc and `reportTarget`'s doc say six kinds and name the two left
  (raw editor, restore — 2d-6-8's).
- **The three components**: each takes a required `reportReceiver: BindObservationReceiver` prop and,
  synchronously in its own initialisation right after `session` is created, reports a receiver that
  installs `applyDeletionObservation` / `applyMoveObservation` / `applyDuplicationObservation` over
  the session held **now** (`MatchDeleter.svelte:247`, `MatchMover.svelte:357`,
  `MatchDuplicator.svelte:334`), and withdraws in `onDestroy`. `MatchEditor.svelte`'s pattern exactly
  (2d-6-6b §2 ruling 3's ordering: reported before the pane's effect registers the surface). Their
  save flows already settle through `() => session`, so a delivery held during a write is consumed
  by `applyDeletion` / `applyMove` / `applyDuplication` or the could-not-be-sent twin (entry 5).
- **`DP`**: hands `reportReceiver={bindReceiver('matchDeleter' | 'matchMover' | 'matchDuplicator')}`
  (`DP:1354`, `:1376`, `:1399`). `transitionOf` needed no change — it already arbitrates for any kind
  the roster `receives`; its doc now says it is a no-op for two kinds, not five.
- **Sentences corrected in place** (entry 41), each "2d-6-7 wires" / "three of those eight" / "the other
  five" about *registration* that this phase made false: the module headers and two docs each of `D`,
  `M`, `U`; `W`'s `observeExternalChange` and `registerObservationReceiver` docs and the
  `observationReceivers` comment; `writeSurfaceRegistry.ts` (two); `observationDelivery.ts`,
  `conflictSource.ts`, `saveOutcome.ts` and `observationTransitions.ts` (one each). Sentences that
  say the operation panels' **rendering** is 2d-6-7's were left: they are still true until 7b.

## 2. Rulings taken here, and what each does not force

1. **One helper for the post-commit policy, not three more copies.** `CLAUDE.md` §6 already holds
   the pattern ("`run_one_save` holds this layer's single cache-coherency policy. A new writer calls
   it; it is never copied"). `saveMatch` was moved onto it in the same edit because leaving it a copy
   would leave two definitions of one rule. **Forced**: no value thrown by any of the five
   wrappers' adoption or re-read rejects after a commit. **Not forced**: that
   `forgetTheReplacedDocument` (run inside the catch) never throws, and that a sixth wrapper calls
   the helper rather than awaiting its adoption bare.
2. **The wait carried by a rebuilt operation session is the settled session's**, as the editor's is
   since 2d-6-6a. Carrying the pre-adoption map dropped a wait recorded during the adoption, which is
   a live send the window had not cleared.
3. **A pre-existing case that pinned the defect was rewritten, not deleted.** `workspace.test.ts:7727`
   (*closes the barrier on what the answer established when the adoption throws*) asserted
   `moveMatch` **rejects** with the re-read's error. It now asserts the `saved` outcome beside a
   `failed` adoption; its four barrier assertions (lease closed, nothing retained, no standing
   origin, no uncertainty) are unchanged and pass — so the settlement the answer established still
   wins over `uncertain`.
4. **The pane's operation panels register over the one file each names**, never over a creator-eligible
   set: `OpenWriteSurface` gives them only the `document` arm. Nothing new about targets was decided.
5. **"Host and surface over one file get one decision" does not apply to the operation panels as a
   pair** — `busy` keeps at most one of the seven non-recovery kinds open, and no operation panel
   mounts a recovery form, so two receivers over one file cannot come from these three. What does
   apply — one arbitration reaching the one registration once — is asserted in the delivery case.
6. **No new user-facing string.** The wiring itself adds none. It does make existing, already
   bilingual sentences reachable under an external conflict: the mover and the duplicator draw
   `tMoveSubmissionRefusal` / `tDuplicationSubmissionRefusal` for `externalConflict` (the
   `fileChangedWhileOpen` sentence), and every panel's `RecoveryWithoutCreation` sees
   `view.conflict`. **Not read here** — no sentence assertion was added (§4 item 1).

## 3. Pinning cases, and their failures before the fix, verbatim

### 3.1 The wrappers (`workspace.test.ts:5803`)

Suite *a committed operation whose follow-up read throws — Phase 2d-6-7a*: one `it.each` of 14 rows
through the real `createBrowserState` over scripted commands — `moveMatch`, `deleteMatch`,
`duplicateMatch` × (`getDocument`, `documentText`) × (an `Error`, a value whose `code` getter
throws), plus `createMatch` × the two reads × the hostile value. Each asserts `answered` / `saved` /
`adoption: failed` and that the barrier closed. Written first; run against the untouched wrappers
(`/tmp/7a-wrappers-prefix.txt`): **14 failed, 332 skipped.**

| Rows | Pre-fix failure, verbatim |
|---|---|
| the six operation rows throwing an `Error` | `Error: the read after the commit threw` |
| the six operation rows throwing the hostile value | `{ code: '<unserializable>: the code getter threw', stacks: [] }` (the rejected value itself, which vitest cannot serialise) |
| the two `createMatch` rows | `Error: the code getter threw` ` ❯ isCommandError src/lib/ipc/errors.ts:743:32` ` ❯ classifyFailure src/lib/ipc/errors.ts:769:7` ` ❯ Object.createMatch src/lib/browser/workspace.svelte.ts:6326:55` |

After the fix the file passes **346 of 346** (with the §2 ruling 3 case rewritten; before the rewrite
it was the one failure: `AssertionError: promise resolved "{ kind: 'answered', …(2) }" instead of
rejecting`).

### 3.2 The reapplies

Four cases in each of the three model suites, inside the *reapply over the external origin* suite,
reusing the suite's own fixtures and a `trappedForReapply` Proxy helper (the editor suite's):

| Case | `matchDeletion.test.ts` | `matchMove.test.ts` | `matchDuplication.test.ts` |
|---|---|---|---|
| displaced by a read of the installed session **before** the adoption | :1613 | :2751 | :1964 |
| displaced by a read of the settled session **after** the adoption | :1632 | :2770 | :1983 |
| another conflict landed **during** the adoption | :1655 | :2793 | :2006 |
| a wait recorded during the adoption is carried | :1674 | :2812 | :2025 |

Written first; run against the untouched modules (`/tmp/7a-reapply-prefix.txt`): **12 failed, 267
passed.** Failures verbatim, identical in the three suites:

| Case | Pre-fix failure |
|---|---|
| before the adoption | `AssertionError: expected 'reapplied' to be 'manualResolution' // Object.is equality` |
| after the adoption | `AssertionError: expected { kind: 'reapplied', …(1) } to deeply equal { kind: 'manualResolution', …(1) }` |
| another conflict during it | `AssertionError: expected { kind: 'reapplied', …(1) } to deeply equal { kind: 'manualResolution', …(1) }` |
| wait carried | `AssertionError: expected undefined to be { sequence: 6, document: 2, …(6) } // Object.is equality` |

After the fix the three files pass **279 of 279**.

### 3.3 The mounted delivery cases (`DetailPane.test.ts:2227`)

Suite *the pane as a delivery host for the operation panels — Phase 2d-6-7a*, over a new fixture
`documentAWithTwo()` (a file of one snippet refuses every deletion and offers no move). Every case
opens its panel through the pane's own control over a real `BrowserState`, starts the lifecycle over
a finite drain queue with `expectedDrains` exact, and wakes the window, so the observation is
admitted by the real coordinator, routed by `targetingSurfaceFor` to the pane's transition,
arbitrated once by `observeExternalChange`, and delivered through the roster's registration.

- *An open {deleter, mover, duplicator} is delivered its file's change, and its send is withdrawn*
  (`:2236`, `it.each` × 3): registered over file 1 alone; one `raised` to the one registration; the
  standing origin is `externalChange`; the send (`Delete it` / `Move` after choosing *end* /
  `Duplicate`) goes from offered to withdrawn; the file is `stale` and not reloaded; no command.
- *Never hands a reopened {…} what its previous instance was told* (`:2281`, × 3): told, closed
  (registrations and the registry empty), reopened fresh with its send offered, then only the second
  registration is told of the later reading (`[0, 1]`).
- *Lands a settlement after the deletion it settles, in the order it was decided* (`:2331`): a
  deletion in flight, the wake is `retained`, the command refuses, the settlement publishes `raised`,
  and the deleter ends holding the external conflict with nothing to send (entry 5). `PaneScript`
  gained an optional `deleteMatch` for it.

Plus `surfaceReceivers.test.ts:187`: the roster registers each operation kind over its own file,
delivers to the right one, and still receives neither `rawEditor` nor `restore`.

**Shown discriminating.** The wiring landed before these cases, so — as 2d-6-6b did — the fix was
reverted for one run: `isReceivingKind` answered `false` for the three operation kinds (a backup
copy restored afterwards, `cmp` identical). **8 failed** (`/tmp/7a-dp-reverted.txt`):

| Case | Failure, verbatim |
|---|---|
| delivered, × 3 | `AssertionError: expected [] to deeply equal [ 1 ]`, then the `afterEach`'s `AssertionError: expected 2 to be 3 // Object.is equality` (one drain fewer than scripted) |
| reopened, × 3 | `AssertionError: expected true to be false // Object.is equality` (the send was never withdrawn), then `AssertionError: expected 3 to be 4 // Object.is equality` |
| settlement | `AssertionError: expected [] to deeply equal [ 'retained' ]` |
| roster | `AssertionError: expected [] to deeply equal [ 1, 2, 3 ]` |

The three component suites (`MatchDeleter.test.ts`, `MatchMover.test.ts`, `MatchDuplicator.test.ts`)
mount the panels directly and gained only an inert `reportReceiver` (a documented `inertBinding()`
helper each); their counts are unchanged.

## 4. Open items for 7b, 7c and later (not fixed here, `CLAUDE.md` §7)

1. **7b — what the three panels now draw under an external conflict is unread.** The wiring makes
   existing sentences reachable (§2 ruling 6): the mover's and duplicator's `externalConflict`
   submission refusal, `RecoveryWithoutCreation` over `view.conflict`, and the deleter's withdrawn
   question with no sentence saying why. None of the external conflict's origin, comparison,
   notices, reapply or reload is drawn deliberately yet; that and the bilingual mounted tests of
   every offered control are 7b's.
2. **7c — no window was read.** Nothing here claims what a window draws.
3. **`adoptForReapply` in `reapply.ts` has no production caller** since this phase. It is still
   exported, documented and driven by `reapply.test.ts`. Whether to delete it (and its header
   item 3) is a later phase's decision.
4. **Still open from 6b §7 item 3**: the doors and settling transitions of all eight sessions not
   re-audited for reads after their last `current()`. Left where `PROGRESS.md` carries it (the cut's
   last paragraph).
5. **Still open from 6b §7 item 1**: raw's `loadDiskVersion` and restore's `reloadTheDiskVersion` —
   before 2d-6-8 registers their receivers. Raw's post-commit wrapper (`saveRawDocument`) is likewise
   2d-6-8's.

## 5. Verification

Each gate ran on its own on the final tree, output redirected to a file and the exit status read from
it, never through a pipe.

| Command | Exit | Evidence |
|---|---|---|
| `npm run check` | 0 | **449 files**, 0 errors, 0 warnings (unchanged: no new file) |
| `npm test` | 0 | **2960 passed**, 65 files (+34 from 2926: `workspace.test.ts` +14, `matchDeletion` / `matchMove` / `matchDuplication` +4 each, `surfaceReceivers.test.ts` +1, `DetailPane.test.ts` +7) |
| `npm run build` | 0 | **193 modules** (unchanged: no new module) |
| `rg -c '\$\$payload\|head_payload\|push_element' dist/assets/index-*.js` | 1 | no match: the server-only markers are **absent** |
| `rg -c 'window\.__svelte\|svelte-trusted-html' dist/assets/index-*.js` | 0 | `2`: the client-only markers are **present** |
| `cargo test --workspace -- --test-threads=1` | 0 | **1323 passed**, 0 failed (unchanged; no Rust edited) |
| `cargo clippy --workspace --all-targets -- -D warnings` | 0 | clean |
| `cargo fmt --check` | 0 | clean |
| `git diff --stat src-tauri/src/main.rs src/main.ts` | 0 | `5 insertions(+), 1 deletion(-)` |

New rung: **`1323 / 449 / 2960 / 193`**. **Git:** read-only commands only (`git status`,
`git diff --stat`). Nothing was staged, committed, stashed or reverted; the four instrument paths are
untouched; `PROGRESS.md` and `PROGRESS.json` were not edited.

## 6. The review's finding, re-derived and fixed

**Codex adversarial review, `ship-with-fixes`: 0 BLOCKERS, 1 SHOULD-FIX**
([`docs/reviews/phase-2d-6-7a.md`](../reviews/phase-2d-6-7a.md)). Per `CLAUDE.md` §7, no re-review
follows this fix.

### The finding: adoption argument reads outside the post-commit catch (`workspace.svelte.ts:6152`)

**Re-derived, and it held — a regression this phase's refactor (§1.1) introduced.** Each call site
read `answer.value.moved` into a local before calling `adoptAfterTheCommit`, and `moveMatch` and
`duplicateMatch` read `answer.value.committed` for the attribution there too. Those reads ran
outside the helper's `try`. In `saveMatch` and `createMatch` the `moved` read had sat inside the
catch before the refactor, so a committed `SaveResult` whose `moved` getter throws, which had been
answered, now rejected the committed write (D2). `moveMatch` and `duplicateMatch` had no catch at all
before this phase. `deleteMatch` reads nothing off the result for its adoption.

**Case** (`workspace.test.ts`, in the suite at `:5803`): *answers a committed %s as saved when the
result's moved getter throws (the review's should-fix)*, an `it.each` over `saveMatch`,
`createMatch`, `moveMatch` and `duplicateMatch` through the real `createBrowserState`. The committed
result's `moved` is an enumerable getter that throws. The case asserts `answered`, outcome `saved`,
adoption `failed`, and the barrier closed. **Pre-fix failure, verbatim** (`/tmp/7a-fix-prefix.txt`):
**4 failed**, each `Error: the moved getter threw`, at

```
 ❯ Object.saveMatch src/lib/browser/workspace.svelte.ts:6152:40
 ❯ Object.createMatch src/lib/browser/workspace.svelte.ts:6258:40
 ❯ Object.moveMatch src/lib/browser/workspace.svelte.ts:6028:40
 ❯ Object.duplicateMatch src/lib/browser/workspace.svelte.ts:6481:40
```

**Fix, at those four sites only.** Each keeps the result object (`const result = answer.value`, which
reads no field) and reads `result.moved`, and in move and duplicate `result.committed`, **inside the
thunk** handed to `adoptAfterTheCommit`, so the helper's catch covers any getter among them. A
comment at each site says so. **Forced**: no getter read to build an adoption argument can reject
after a commit. **Not forced**: the reads before the helper — `outcome`, `committed` and `revision`
for `outOfDate` — are still outside it. The finding did not name them, and `settlementOfOutcome`
reads the same result before any of them (§7 item 1).

**After the fix:** `workspace.test.ts` passes 350 of 350.

### Gates after the fix round

Each command ran on its own, with its output redirected to a file and its exit read from that file.

| Command | Exit | Evidence |
|---|---|---|
| `npm run check` | 0 | **449 files**, 0 errors, 0 warnings |
| `npm test` | 0 | **2964 passed**, 65 files (+4: the four rows above) |
| `npm run build` | 0 | **193 modules** |
| `rg -c '\$\$payload\|head_payload\|push_element' dist/assets/index-*.js` | 1 | no match: the server-only markers are absent |
| `rg -c 'window\.__svelte\|svelte-trusted-html' dist/assets/index-*.js` | 0 | `2`: the client-only markers are present |

No Rust changed, so §5's Rust cells stand. New rung: **`1323 / 449 / 2964 / 193`**. No git write
command was run. The four instrument paths, `PROGRESS.md` and `PROGRESS.json` were not touched.

## 7. Open items noticed in the fix round (not fixed, `CLAUDE.md` §7)

1. **The wrappers still read the committed result outside any catch before the adoption.** They read
   `write.expect(settlementOfOutcome(answer.value))`, `answer.value.outcome` and the `outOfDate` test
   (`committed`, `revision`). A getter among those still rejects a committed write, and that was true
   before this phase too. Closing it means classifying the result once, into plain data, before the
   first read; that is a later phase's decision.
