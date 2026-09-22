# Phase 2d-6-6a — the model-side obligations, before any wiring

**Status: implemented, reviewed once (`ship-with-fixes`, 2 blockers and 1 should-fix, all three
held), fixed, gates green.** §7 records the fix round.
Risk class: **medium** — a signature change on every door, settling transition and reapply of all
eight session values (a reader made required, and on the editor, the creator and the recovery form
added where none existed), one `BrowserState` member widened by a parameter, the read order of
three operation doors and three reapplies changed, and ~900 test call sites rewritten mechanically.
**No Rust, no new module, no new component, no new dictionary key, no `.svelte` change beyond call
sites.**

This is the first of the three sub-phases 2d-6-6 was cut into ([`2d-6-split-notes.md`](2d-6-split-notes.md)
§2, *The orchestrator's cut of 2d-6-6*). It discharges the three obligations `PROGRESS.md` (*What
2d-6-6 owes the closed steps*, items (1)-(3)) names: (1) the reader required everywhere — 2d-6-4
§1.6 / §4 item 4, 2d-6-5 §1.7 / §4 item 4, 2d-6-3 §6 finding 1; (2) the three operation doors'
read-after-reader defect — 2d-6-5 §4 item 11, fixed in 2d-6-5 §7 finding 1's shape; (3) the three
authored reapplies — 2d-6-4 §4 item 4, in 2d-6-4's pattern (c) and §7 finding 4's order.

---

## 1. What changed, per obligation

Line numbers are of the final tree. `E` is `src/lib/browser/matchEditor.ts`, `C`
`matchCreation.ts`, `V` `recovery.ts`, `D` `matchDeletion.ts`, `M` `matchMove.ts`, `U`
`matchDuplication.ts`, `W` `rawEditor.ts`, `S` `restore.ts`.

### 1.1 The reader, required on every door and settling transition of all eight sessions (obligation 1)

- **Five modules already had the reader, optional** (`current: … | null = null`): `D`, `M`, `U`,
  `W`, `S`, and `V`'s `sendRecoveryCreate`. Every such parameter is now **`current:
  ReadTheInstalledSession`** (or `ReadTheInstalledForm`), every `current === null ? session :
  current()` is `current()`, every `if (current === null) return replayed;` inside
  `consumingHeldDeliveries` is gone, and every `@param current` says *Required*. The reader-type docs
  (`D:783`, `M:1521`, `U:1028`, `W:844`, `S:2667`, `V:2344`) no longer say the parameter is optional
  or that 2d-6-6 "may make it required"; they say it is required since this phase and name what no
  type can force — that the closure reads the installed session rather than a capture.
- **Two modules had no reader at all** — the editor and the creator — and the recovery form had one on
  its send composition alone. The acceptance ("non-optional in every door/settling transition
  signature of all eight session modules") and the class the reader closes both apply to them, so
  they gained it (§2 ruling 1):
  - **`ReadTheInstalledSession`** on `E:1596` and `C:1494`.
  - **`beginSave(session, current)`** (`E:1645`), **`beginCreate(session, current)`** (`C:1527`),
    **`beginRecoveryCreate(session, current)`** (`V:1876`): every caller-controlled read first — the
    refusal predicate, the submission, the wire value and its carriage-return check, the spread of
    the waiting session — then `current()` once, and `current() === session ? started : null`, so
    nothing caller-controlled runs between the read and the answer (2d-6-5 `beginSave`'s shape).
  - **`applySave` / `saveCouldNotBeSent`** (`E:1764`, `E:1925`), **`applyCreate` /
    `createCouldNotBeSent`** (`C:1601`, `C:1734`), **`applyRecoveryCreate` /
    `recoveryCreateCouldNotBeSent`** (`V:1943`, `V:2116`) take `current` last, and each module's
    private `consumingHeldDeliveries` (`E:1863`, `C:1682`, `V:2058`) now replays **in rounds**
    through a private `extendsTheReplayed` (`E:1892`, `C:1711`, `V:2026`) — 2d-6-4's pattern (b),
    copied from `D:1054`.
  - `sendRecoveryCreate` (`V:2403`) hands its reader to `beginRecoveryCreate` and to both settling
    transitions, the throw path included, and **answers `current()` when the door refuses** — the
    installed form, never the argument (§7 finding 2; the first landing returned the argument).
- **The reapplies' `standing` guard is nullable rather than defaulted** on the six surfaces that take
  one (`E:2810`, `C:2523`, `V:2970`, `D:1719`, `M:2672`, `U:1984`): a required reader cannot follow
  a defaulted parameter without making every caller pass `undefined`, so `standing:
  StandingOriginGuard | null` is required and a caller states `null`. Each doc says why, and that
  the live closure is 2d-6-6b's wiring.
- **`BrowserState.restoreDocument(started, surfaces, invalidate, current)`** (`workspace.svelte.ts:2521`
  interface, `:6646` implementation) gained the fourth parameter, typed as restore's reader (imported
  as `ReadTheInstalledRestore`), and passes it to `sendRestore`, `restoreConfirmationWithdrawn`,
  `restoreCouldNotBeSent` and `applyRestore`. The doc says why it is a parameter: this state holds no
  session and cannot read one. It is a `BrowserState` member, not the `ReconciliationWorkspace`
  interface, which is not widened (the standing ruling).
- **Every caller passes one.** Components, mechanically at their call sites (§2 ruling 3):
  `MatchEditor.svelte`, `MatchCreator.svelte`, `MatchDeleter.svelte`, `MatchMover.svelte`,
  `MatchDuplicator.svelte`, `RawEditor.svelte`, `RestorePane.svelte` (its `restore` prop type gained
  the reader), `RecoveryPanel.svelte`, and `DetailPane.svelte` (the `restore` arrow passes the fourth
  argument through). Tests: ~900 call sites across nine suites (§2 ruling 5).

### 1.2 The three operation doors: nothing caller-controlled after the reader (obligation 2)

- **`confirmDelete`** (`D:865`): the pending identity, the session's identity and **the submission**
  are read first — the comparison with `projected` is now against `submission.candidate`, so the
  identity compared is the one sent rather than a second read of the draft's value — then
  `canRequestDelete`, then the spread of the waiting session, and only then `current()`, once;
  `current() !== session` answers `null`.
- **`beginMove`** (`M:1600`): `projected`, `session.closed` and `refusalGiven` are asked, the
  submission taken, the placement lowered and the `StartedMove` built; then `current() === session ?
  started : null`.
- **`beginDuplicate`** (`U:1096`): the submission is taken first and `live` compares `projected` with
  `submission.candidate`; `closed` and `refusalGiven` are asked, the `StartedDuplication` built;
  then the reader.
- The three docs now say *every caller-controlled read comes first, and the installed session is read
  once, last*, and what that cannot force (an honest reader; a caller redefining a property of the
  very session it handed in — a receiver replaces and never mutates).

### 1.3 The three authored reapplies: blocks first, installed session asked before adoption (obligation 3)

- **Editor** (`E:2810`), **creator** (`C:2523`), **recovery** (`V:2970`) now ask their blocks
  **before `enterReapply`** whenever a conflict is shown — `uncertaintyUnresolved` →
  `writeOutcomeUnknown`, the own-file wait → `observationRetained`, and on the two forms a form naming
  no file → `destinationRequired` — so a blocked session reads no evidence (2d-6-4 §7 finding 4). A
  session showing no conflict still reaches the entry and answers `notAttempted`. The creator keeps a
  second `held === null` check after the entry, stated as the narrowing's, unreachable once a
  conflict is shown.
- **Immediately before `adoptForReapply`**, after every read of caller data, each reads the installed
  session through the required `current` and refuses `writeOutcomeUnknown`,
  `observationRetained`, or `supersededEvidence` when `conflictOf(installed)?.source !==
  entry.conflict.source` (2d-6-4's pattern (c), `D:1719`'s shape) — **and reads it once more after
  the adoption** (§7 finding 1; the first landing read it before the adoption only, which is not
  enough, because `adoptDiskVersion` itself reads the observation's projection): a session now
  showing another conflict answers `supersededEvidence` and is not rebuilt over, and the rebuilt
  session or form carries the `awaitingReconciliation` read then, so a wait recorded during the
  adoption survives. The editor builds its answer before the first read.
- The three docs said "three refusals come before any evidence is read" (creator, recovery) or "refuses
  before reading any evidence" (editor, the uncertainty only) while the entry came first; they now say
  what the code does and that the previous sentence claimed an order the code did not have.

### 1.4 Sentences corrected (entry 41), in the files this diff touches

Every "optional so that `X.svelte`, which this phase may not touch … 2d-6-6 must pass `() => session`
… may make the parameter required", every "`null`, the default, …", every "Without a reader …" and
"with a reader supplied" in the eight modules; the `unaskedGuard` docs' "the one component caller,
which 2d-6-N may not touch" (now: which passes `null` until 2d-6-6b hands the live closure down);
the `heldDeliveries` field docs' "nor that a caller passes the reader … passes none today"; and in
the tests the six "Without a reader the transition … and says so" comments, which now describe the
cost of a reader answering a capture — the only way left to reach that cost.

## 2. Rulings taken here, and what each does not force

1. **The editor, the creator and the recovery form gained a reader on their doors and settlements,
   not only on their reapplies.** Obligation (1) and the acceptance name all eight modules, and the
   class is theirs as much as the operation sessions': `beginSave` spreads the session after its
   checks, and a replay reads observations. The 2d-6-3 record's argument that the creator's
   component settles its live session after the await is true and is not the whole class — the rounds
   are about deliveries appended *during* the replay itself. What it does not force: that the
   component's closure is honest, which no type can.
2. **`requestDelete` still takes no reader**, for the reason its doc already gives: its one operand
   is the module-built session and recording a question spends nothing external. The **six reloads
   other than raw's and restore's** take none either — not a door or a settling transition in the
   records' sense, and not one of this phase's obligations (§4 item 1).
3. **A component whose door is handed a session derived in the same synchronous block** — a consent
   just recorded (`acknowledgeFindings` and its three twins), a reload confirmation just taken
   (`confirmReload`, `confirmDiskReload`) — passes `() => (session === held ? derived : session)`:
   the derived session while the installed one is still the session it was derived from, the
   installed session otherwise. `() => session` there would read as a displacement on every press
   and refuse every *Save anyway* and every reload; installing the derived session first would record
   consent for a save that may then be refused. `RawEditor.svelte`'s nullable `session` adds a `===
   null` arm that answers the derived session (nothing in the handler sets it back to `null`), and
   its settlements fall back to `started.session`.
4. **`RecoveryPanel.svelte` genuinely may hold no form** (`session` is nullable), and this is the one
   caller where "no installed session" is a state. Decided: the reader answers the form this send
   started from when the panel holds none — `() => (session === held ? consented : (session ??
   consented))` — because that state is unreachable between the install and the settlement
   (`abandon` refuses while a send is in flight, and nothing else empties it), and answering the
   form handed in is the pre-2d-6-6a behaviour rather than an invented form. Stated in a comment at
   the call. The reapply's reader is `() => session ?? held` for the same reason.
5. **The tests.** A codemod driven by `svelte-check`'s `Expected N arguments` positions rewrote every
   call that had no reader: a simple first operand (an identifier or a property chain) gets `() =>
   operand`; any other operand is evaluated once through `((onHand) => door(onHand, …, () =>
   onHand))(operand)`, explained by a block comment after each suite's imports; a missing `standing`
   is `null`. Two helpers stand for what a real caller holds: **`sendTracking`** (`recovery.test.ts`,
   `workspace.test.ts`) — the form handed in until `install`, then the waiting form, which is what
   `RecoveryPanel.svelte` holds — and **`ownSessionOf` / `neverRead`** (`workspace.test.ts`) for
   `restoreDocument`. A reader answering exactly the session handed in reproduces the old `null`
   semantics, which is why every pre-existing case passes unchanged in its assertions. Three cases
   needed more than the codemod: the 2d-6-3 recovery case whose reader threw when read before the
   installer now answers the handed-in form until then (the door reads it first now), and its two
   loops hand in a named form instead of a fresh `openedOverEditor()` per read.
6. **No behaviour of the running app changes.** No component registers a receiver yet (2d-6-6b), so
   every reader answers the session handed in at every call a person can make.
7. **A reapply handler evaluates the outcome first and folds it into the session still installed**
   (§7 finding 3) — `const outcome = reapply…(…); const attempt = attemptOfReapply(session,
   outcome);` in all six handlers — because a refused reapply leaves whatever a receiver installed
   during it.

## 3. The acceptance clauses, checked

*The reader non-optional everywhere*: `rg -n "current: ReadTheInstalled\w+ \| null|current === null"
src/lib/browser/*.ts` finds nothing outside the tests' own holders; `npm run check` compiles every
caller. *Pinning cases, failing first, passing after* — written before the first source edit, run
against the untouched modules, failures read from the run:

| Case | File:line | Pre-fix failure, verbatim |
|---|---|---|
| *refuses a confirmation when a later read of this door displaced the installed session* | `matchDeletion.test.ts:1643` | `AssertionError: expected { session: { …(17) }, …(2) } to be null` |
| *refuses a move when a later read …* | `matchMove.test.ts:2776` | `AssertionError: expected { session: { …(22) }, …(3) } to be null` |
| *refuses a duplicate when a later read …* | `matchDuplication.test.ts:1983` | `AssertionError: expected { session: { …(20) }, …(2) } to be null` |
| *refuses a confirmation whose later draft read let the window displace the installed session* (real `observeExternalChange`, the deleter's registered receiver) | `workspace.test.ts:11269` | `AssertionError: expected { session: { …(17) }, …(2) } to be null` |
| *reads no evidence for a session / form that is already blocked* (counting `correspondences` getter) | `matchEditor.test.ts:2702`, `matchCreation.test.ts:2205`, `recovery.test.ts:2735` | all three: `AssertionError: expected 2 to be +0 // Object.is equality` |
| *rechecks the installed session / form immediately before adopting, and refuses what a read delivered during the reapply* (getter behind the row's `editor` tier, the anchor row's `exact` tier, the disk projection's `relative_path`) | `matchEditor.test.ts:2735`, `matchCreation.test.ts:2241`, `recovery.test.ts:2767` | all three: `AssertionError: expected { kind: 'reapplied', …(1) } to deeply equal { kind: 'manualResolution', …(1) }` |

The model door cases measure the door's reads of the draft's value on a quiet getter and then deliver
on each in turn, plus once from an own property the spread reads (`extraMessages`); the window case
measures, then delivers on the last read. **Two honesty notes.** The window case's first draft
delivered on the second read, which the fixed door never makes, so it failed after the fix too; it
was rewritten to measure first, and its pre-fix failure was then re-read by putting the pre-fix
`confirmDelete` body back for one run and restoring the fixed file (`cmp` identical). The three
reapply cases' pre-fix runs failed on their first recheck assertion; two later fixtures were
corrected once the fixed code reached them — the recovery case's later reading used `'d'.repeat(64)`,
which is that suite's `AFTER`, so the arbitration answered `coalesced` rather than `supersedes`
(now `'f'.repeat(64)`), and the creator's quiet arm expected a `retained` about another file to be
recorded, which that receiver does not do (now a read that delivers nothing).

**Verification at the first landing, each gate on its own, exit read from a file** (after the fix
round: §7). `npm run check`: **447 files, 0
errors, 0 warnings**, exit 0 (unchanged count). `npm test`: **2827 passed, 64 files** (+10 from
2817: `matchDeletion.test.ts` 64 → 65, `matchMove.test.ts` 106 → 107, `matchDuplication.test.ts` 76
→ 77, `matchEditor.test.ts` 128 → 130, `matchCreation.test.ts` 96 → 98, `recovery.test.ts` 90 → 92,
`workspace.test.ts` 321 → 322; every other file unchanged). `npm run build`: **192 modules**
(unchanged); `rg -c '\$\$payload|head_payload|push_element' dist/assets/index-*.js` prints nothing;
`rg -c 'window\.__svelte|svelte-trusted-html' dist/assets/index-*.js` prints `2`. Nothing under
`src-tauri/` or `crates/` was edited, nor `PROGRESS.md` / `PROGRESS.json`. **Git**: one read-only
`git diff --stat` was run by mistake mid-phase (no stash, add, checkout or commit); nothing else.

## 4. Open items deliberately left, none a defect of this phase

1. **The six reloads other than raw's and restore's take no reader** — `reloadTheDiskVersion` on the
   editor, the creator, the deleter, the mover and the duplicator, and recovery's
   `reloadRecoveryDiskVersion`. 2d-6-5 §7 finding 3 showed an adoption reads caller data (the
   observation's projection) and fixed raw's and restore's; the same shape on these six was not an
   obligation of this phase and is not fixed here. 2d-6-6b, which registers the editor's, the
   creator's and recovery's receivers, is where a delivery during that adoption first becomes
   reachable on three of them; 2d-6-7 on the other three.
2. **Every component passes `standing: null`** — the live `BrowserState.standingConflictFor` closure
   is 2d-6-6b's wiring; each reapply doc says what `null` costs (a sentence, never a wrong
   installation).
3. **No component registers a receiver** (2d-6-6b, 2d-6-7, 2d-6-8), so the readers every component
   now passes are exercised by the model and window suites only; a mounted case that a delivery
   during a door's read is refused is 2d-6-6b's.
4. **The test idiom is verbose**: 266 `((onHand) => …)(…)` sites. It evaluates each operand once and
   keeps every assertion as it was; a later phase that rewrites a suite may prefer a named local.
5. **Noticed in the fix round, not fixed there (`CLAUDE.md` §7)** — the `supersededEvidence` arm of the
   post-adoption read (the adoption answered `installed` or `alreadyThere` and the installed session
   then shows another conflict) is written but not pinned: through the real door a superseding
   reading during the adoption makes the door refuse the outlived origin (`adoptionRefused`), so no
   interleaving that reaches the arm was constructed. And finding 3 is pinned over the model's own
   transitions, not through a mounted component: no component registers a receiver, so nothing can
   write a component's `session` during its synchronous reapply handler; 2d-6-6b's mounted delivery
   tests are where the handlers' order first becomes observable, and should pin it there.
6. **Items carried from 2d-6-5 §4 unchanged**: 1-3, 5-10, 12, 13. Item 4 (the optional reader) and
   item 11 (the operation doors) are closed here; 2d-6-4 §4 item 4's second half (the three authored
   reapplies) is closed here.

## 7. The review's findings, re-derived and fixed

**Codex adversarial review, ship-with-fixes: 2 BLOCKERS, 1 SHOULD-FIX**
([`docs/reviews/phase-2d-6-6a.md`](../reviews/phase-2d-6-6a.md)). Each was re-derived by writing the
case first against the landed tree and reading its failure; **all three held**. No re-review follows
this fix (`CLAUDE.md` §7); what was noticed on the way is §4 item 5.

1. **[BLOCKER] the three authored reapplies (`E:2810`, `C:2523`, `V:2970`) — the installed session
   was read before the adoption only, and `adoptDiskVersion` then reads the observation's projection;
   a getter there that starts another surface's write and tells the window of a later reading gets it
   retained, the registered receiver records a wait on the installed session, and the rebuilt
   session handed back carried none. Held, on all three.** This is exactly 2d-6-5 §7 finding 3's
   class on the reloads, which §1.3 had not carried to the reapplies. **Cases**, through the real
   door (`workspace.test.ts`, a trapped `disk.id` armed inside an `adopt` that forwards to
   `state.adoptDiskVersion`, a held raw save started from the getter): *carries a wait the window
   recorded during the reapply's own adoption into the rebuilt session* (editor), *… rebuilt creator*,
   *… rebuilt recovery form*. **Pre-fix failure, verbatim** — editor: `AssertionError: expected null
   to be { sequence: 6, document: 2, …(6) } // Object.is equality`; creator and recovery form:
   `AssertionError: expected undefined to be { sequence: 6, document: 2, …(6) } // Object.is
   equality`. **Fix:** after a non-refused adoption each reapply reads `current()` again; another
   conflict (by source identity) answers `supersededEvidence` and rebuilds nothing, and otherwise the
   rebuilt session or form carries the `awaitingReconciliation` read then. §1.3 now says what the code
   does. What it does not force: that the reader is honest; the arm the second read adds for another
   conflict is not pinned (§4 item 5).
2. **[BLOCKER] `sendRecoveryCreate` (`V:2403`) — when `beginRecoveryCreate` refused because a
   receiver had displaced the form during the door's reads, the composition answered the form handed
   in, and a caller that installs the answer (`session = await sendRecoveryCreate(…)`, as
   `RecoveryPanel.svelte` does) overwrote what its receiver had installed. Held.** **Cases:** *answers
   the installed form, never the capture, when a read of the door displaced it* (`recovery.test.ts`,
   the caller's own assignment shape) and *answers the installed recovery form when a read of the door
   let the window displace it* (`workspace.test.ts`, a real `observeExternalChange` from a getter
   behind the draft's value, a registered receiver, `createMatch` never called). **Pre-fix failure,
   verbatim, both:** `AssertionError: expected { Object (origin, transfer, ...) } not to be { Object
   (origin, transfer, ...) } // Object.is equality`. **Fix:** the refused-door arm answers
   `current()`; for a refusal that displaced nothing an honest reader answers the form handed in, so
   no other answer changes (every pre-existing case passes unchanged).
3. **[SHOULD-FIX] the six reapply handlers (`MatchEditor.svelte`, `MatchCreator.svelte`,
   `MatchDeleter.svelte`, `MatchMover.svelte`, `MatchDuplicator.svelte`, `RecoveryPanel.svelte`) —
   `attemptOfReapply(session, reapply…(session, …))` evaluates its first argument before the reapply
   runs, so a refusal caused by a delivery during the reapply folded into, and reinstalled, the
   session read beforehand. Held as an ordering fact; not reachable through any component today**,
   because no component registers a receiver and nothing else writes `session` inside the
   synchronous handler. **Case:** *keeps the installed session when a refused reapply is folded by a
   panel's handler* (`matchEditor.test.ts` — the handler's expression over the real transitions, a
   row getter delivering `retained`, the reapply refusing `observationRetained`). **Pre-fix failure,
   verbatim** (the case written in the handlers' first-landing order): `AssertionError: expected {
   match: { document: 1, …(2) }, …(19) } to be { match: { document: 1, …(2) }, …(19) } //
   Object.is equality`. **Fix:** every handler evaluates the outcome first and passes the session
   still installed (`session ?? held` on the recovery panel); the case now uses that order. What it
   does not force: a mounted pin (§4 item 5).

**Gates after the fix round, each on its own, exit read directly.** `npm run check`: 447 files, 0
errors, 0 warnings, exit 0. `npm test`: **2833 passed, 64 files**, exit 0 (+6 from 2827:
`workspace.test.ts` 322 → 326, `recovery.test.ts` 92 → 93, `matchEditor.test.ts` 130 → 131). `npm
run build`: 192 modules, exit 0; `rg -c '\$\$payload|head_payload|push_element'
dist/assets/index-*.js` prints nothing; `rg -c 'window\.__svelte|svelte-trusted-html'
dist/assets/index-*.js` prints `2`. No git command of any kind was run in the fix round; nothing
under `src-tauri/`, `crates/`, `PROGRESS.md`, `PROGRESS.json` or the review file was edited.
