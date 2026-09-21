# Phase 2d-5-6 — the file-wide route-guard closure

**Status: implemented, gates green, awaiting the phase's one review.** Risk class: **low** — three
test files and this record change; no `.svelte` renderer, no Rust, no production `.ts` module.
`git diff --stat src/lib/browser/workspace.svelte.ts` is empty on the final tree.

This is step 6 of the design consult ([`docs/reviews/phase-2d-5-design.md`](../reviews/phase-2d-5-design.md)).
Binding rulings **34 and 35** of [`2d-5-split-notes.md`](2d-5-split-notes.md) §3 are this phase's,
and §7 of that record is the measurement it starts from. The work item itself is
[`2d-4b-notes.md`](2d-4b-notes.md) §14.8 item 1, carried since 2026-09-05 and discharged **here**.

---

## 1. What was already there, and what this phase added

`src/lib/browser/workspace.svelte.ts` imports its command wrappers at module level (`:44-61`) and
assembles `REAL_COMMANDS` from them (`:359`), so a wrapper that reached one of those bindings instead
of its injected `commands` parameter would increment the test-side `drains` counter in nothing. Since
2d-5-5b every one of the six writing wrappers also opens a barrier lease immediately before its
command and closes it in a `finally`, so the same escape would bypass the barrier as well.

**Two of the three files already had the hoisted `@tauri-apps/api/core` spy, and none asserted it
file-wide.** And `workspace.test.ts` already had most of ruling 35: Phase 2d-5-3 gave it
`expectDrains(count)`, a finite scripted queue, `drainsPending` and an `afterEach` asserting the
count and the pending half. What it did not have was a spy at all, a cursor in the budget, or any
question about coordinators and leases. This phase added exactly those, plus the file-wide assertion
in the two component files.

## 2. The table, re-derived on the final tree with `rg`

Line numbers on `HEAD` (`c3e0211`) first, then on the final tree. Case counts are `it(` lines plus
table rows: `workspace.test.ts` has one `it.each(WRITERS)` of 6 rows (239 + 6 = **245**, the 239th being the review fix's negative control);
`DetailPane.test.ts` has 17 plain `it(` plus one inside a loop over the 7 `WALKS` (**24**);
`RestorePane.test.ts` has 27 plain `it(`, an `it.each(SCANNED)` of 2 × 16 and an `it.each(LOCALES)`
of 2 (**61**). All three agree with the verbose reporter's counts.

| File | core spy | `drains` counter (incremented) | file-wide `afterEach` | `expect(invoked)` | cases |
|---|---|---|---|---|---|
| `workspace.test.ts` — HEAD | **none** | `:352` (`:551`) | `:588`, count + pending | **0** | 244 |
| `workspace.test.ts` — now | `:171`, rejects | `:383` (`:759`) | `:803-858`, route + coordinators + leases + cursors + count + pending + unscripted | **1** — `:828`, the `afterEach` | 245 |
| `DetailPane.test.ts` — HEAD | `:72`, rejects | `:224` (`:313`) | `:573`, zero drains | **2** — `:766`, `:1290` | 24 |
| `DetailPane.test.ts` — now | `:81`, rejects | `:233` (`:322`) | `:587-603`, route + zero drains | **3** — `:595` (the `afterEach`), `:787`, `:1311` | 24 |
| `RestorePane.test.ts` — HEAD | `:117`, rejects | `:445` (`:527`) | `:759`, zero drains | **5** — `:808`, `:911`, `:941`, `:968`, `:1084` | 61 |
| `RestorePane.test.ts` — now | `:125`, rejects | `:453` (`:535`) | `:772-788`, route + zero drains | **6** — `:780` (the `afterEach`), then the five | 61 |

The 2026-09-05 record said 186 / 8 / 27 cases and 0 / 1 / 5 `invoked` assertions; three phases moved
`workspace.test.ts` since, and the 2d-5-2b chain and 2d-5-4-D moved `DetailPane.test.ts`, which is
why the counts were re-derived rather than copied.

## 3. The rulings, and how each is discharged

**Ruling 34 — mock the core, never the command module.** `workspace.test.ts` now carries the same
`vi.hoisted` + `vi.mock('@tauri-apps/api/core', …)` shape the two component files had, byte-for-byte
in the code and with the same comment adapted in each: an `invoke` that records on `invoked` and
**rejects**.
`$lib/ipc/commands` and `REAL_COMMANDS` are untouched and real, which is what makes a module-level
bypass run the real wrapper down to the spy. Every file's `afterEach` now asserts
`expect(invoked).not.toHaveBeenCalled()`, zero in every case, and every file clears the spy in a
`beforeEach` so a failure is attributed to the case that caused it. The seven pre-existing per-case
`invoked` assertions (two in `DetailPane.test.ts`, five in `RestorePane.test.ts`) are now **strictly
redundant in effect** — the spy only accumulates, so an end-of-case zero implies every mid-case zero
— and are kept because each sits beside the action it is a claim about; none is required any more.

**Ruling 35 — the blanket zero is replaced, not deleted.** In `workspace.test.ts` the budget is now
the **list of cursors**: `expectDrains([0, 0, 5])` declares three drains asked with `afterSequence`
0, 0 and 5, and the `afterEach` asserts `drainSequences` equals it, `drains` equals its length and
`drainsPending` is zero — three lines, because a wrong watermark, a missing drain and an unconsumed
answer are three defects. The 33 declarations were rewritten from a **measured** run (a temporary
file write in the `afterEach`, since removed), not inferred; every list's length equals the count it
replaced. The 17 inline `expect(drainSequences)` assertions stay, since they pin intermediate states.
In the two component files no case starts a coordinator, so the exact budget is **zero for every
case** and `expect(drained).toBe(0)` stays with a comment saying that is the budget rather than a
blanket; a scripted queue nobody consumes would be dead code under `noUnusedLocals`.

**The barrier.** `BrowserState.writeInFlight(document)` is the public reader, so no production
accessor was needed. `createBrowserState` in the test file is now a same-named recording wrapper over
the aliased import; the `afterEach` asks every recorded state about every file it lists **and** every
file one of its six writing stubs was asked to write (`filesWrittenThrough`, read from the `vi.fn`
records — each wrapper opens its lease on exactly the identity it hands its command). `openLeasesOf`
must answer `[]`.

**Coordinators.** The same wrapper installs `vi.spyOn(state, 'start')` and `'dispose'`, and the
`afterEach` requires every started state to have been disposed. **No existing case leaked one**: the
33 `start()` calls all had their `dispose()`, and the two component mount helpers now dispose the
state in `stop()`, so the rule holds for every state those files build (nothing there starts one
today, so this releases nothing). Fixes counted: **0** in `workspace.test.ts`, one `dispose()` added
per mount helper in each component file.

## 4. Evidence that each assertion bites

Each check was made on the final harness by a temporary change that was then reverted; the tree was
compared with `git diff --stat` afterwards.

1. **The route.** `workspace.svelte.ts:4661` changed from `commands.saveMatch(` to `saveMatch(` — the
   module-level binding. Result: `16 failed | 313 passed`, 14 in `workspace.test.ts` and 2 in
   `DetailPane.test.ts`; the file-wide assertion's first line was
   `AssertionError: expected "vi.fn()" to not be called at all, but actually been called 1 times`,
   followed by `1st vi.fn() call: [ "save_match", { acknowledgement: …, baseRevision: "rev-a", … } ]`.
   Reverted; `git diff --stat src/lib/browser/workspace.svelte.ts` is empty.
2. **Coordinators.** One `state.dispose()` commented out in the registration-drain case:
   `expected 1 to be +0` at the `undisposed` line.
3. **The barrier.** A temporary case that started a `duplicateMatch` over a never-resolved deferred:
   `expected [ { state: +0, document: 2 } ] to deeply equal []`.
4. **The cursor.** `expectDrains([0, 11])` changed to `[0, 10]` in the wake case:
   `expected [ +0, 11 ] to deeply equal [ +0, 10 ]`.

## 5. What the closure establishes, and what it does not

It establishes that **in these three files** no wrapper reaches the real `invoke`, no drain happens
outside a declared budget or with an undeclared cursor, no started coordinator outlives its case, and
no write lease the harness can name is left open. It does **not** establish anything about a file
that is not one of the three: nothing in TypeScript, in Vitest or in this repository prevents a
future test file from importing `$lib/ipc/commands`, or building a `BrowserState` over
`REAL_COMMANDS`, with no spy at all. That residual is §14.8 item 1's own sentence, and it stands.

## 6. Where it is thin

1. **The barrier question is asked by enumeration, not of the table.** `writesInFlight` is private
   and `writeInFlight` answers one file at a time, so the harness names candidates: listed documents
   plus the first argument of every recorded writing call. A lease on a file neither source names is
   invisible; no wrapper opens one today. A later phase wanting the table itself would add a
   read-only `writesInFlightSnapshot()` to `BrowserState`, which this phase deliberately did not.
2. **The two component files ask neither the barrier nor the coordinator question in `afterEach`.**
   Their single write path is a stub that settles promptly and nothing they draw starts a
   coordinator; `stop()` disposes every state. A restore case that left a raw save unsettled would not
   be caught there.
3. **A writing member replaced by something other than a `vi.fn` records no calls**, so its files
   come only from the state's document list. Every override in `workspace.test.ts` today is a
   `vi.fn`; nothing enforces that.
4. **`BARRIERED_MEMBERS` is a hand-kept list of six.** A seventh writing wrapper, or one that opened
   its lease on an identity other than the one it hands its command, would not be reflected; the
   comment says so.
5. **The three files are uniform by inspection, not by a shared helper** — three copies of the same
   seven lines. The `2d-4b-notes.md` §11.8 pointer in the drain stub's comment is now labelled
   "before 2d-5-6"; the record it points to describes the two component suites as they were.
6. **`vi.spyOn` replaces `start` and `dispose` on every recorded state.** Nothing today compares
   those methods by identity; a future case that did would see the spy.
7. **The negative control of the unscripted-drain counter clears the counter itself.** The case
   `counts a drain the scripted queue had no answer for` provokes one unscripted drain, asserts the
   count, and then sets `drainsUnscripted = 0` so its own `afterEach` stays green. That line is an
   opt-out of the file-wide assertion, and nothing in Vitest prevents a second case from copying it;
   the comment beside it says so, and a reviewer who finds a second one has found a case hiding an
   unscripted drain. It was proven to bite by disabling the reset: the `afterEach` failed that case
   with `AssertionError: expected 1 to be +0`.

## 7. Verification

Every command run on its own, on the final tree.

| Gate | Command | Result |
|---|---|---|
| vitest | `npm test` | exit 0 — **2467 passed in 61 files** (2466 before the review's fix added its negative control) |
| svelte-check | `npm run check` | exit 0 — **443 files, 0 errors, 0 warnings** |
| Vite | `npm run build` | exit 0 — **189 modules** |
| Bundle, server-only | `rg -c '\$\$payload\|head_payload\|push_element' dist/assets/index-*.js` | **absent** — no output, 0 lines |
| Bundle, client-only | `rg -c 'window\.__svelte\|svelte-trusted-html' dist/assets/index-*.js` | **present, 2** |

The rung moves by one, to **`1320 / 443 / 2467 / 189`**: no Rust source changed, and the Rust gate
was re-run by the orchestrator anyway (`cargo test --workspace -- --test-threads=1`, exit 0, 26
`test result` lines summing to 1320, none lacking `0 failed`); no file was added or removed except
this record, so the svelte-check count held; the implementation added no case — every change is
inside an existing harness or an existing case — and the review's fix added exactly one, the
negative control of §6 item 7, so vitest moved 2466 → 2467; no `.ts` production module or styled
component was added, so Vite held at 189.

`git status --short --untracked-files=all` names the three test files, this record, and the five
paths that are not this phase's: `PROGRESS.json`, the two instrument hook files (still `5
insertions(+), 1 deletion(-)` together) and the two untracked instrument files.

## 8. The phase's review, and its one disposition

The phase's one adversarial review is [`docs/reviews/phase-2d-5-6.md`](../reviews/phase-2d-5-6.md),
written by **Codex** through `autoclaude-review.sh` (exit 0) against the brief at
`docs/reviews/phase-2d-5-6.brief.md`. Verdict **`ship-with-fixes`, 0 blockers, 1 SHOULD-FIX**; its
body was truncated by the runner, as every review's has been, so the finding was re-derived before it
was taken:

- **SHOULD-FIX — `workspace.test.ts:833` as the review cited it on the pre-fix tree (the `afterEach`'s budget block, `:843-857` now), a drain without a scripted answer stayed green.** The
  finding, re-derived: the drain stub's fallback branch — reached when `script.drains` has nothing
  at index `drained` — incremented `drains`, pushed the cursor and answered `noWorkspaceOpen`, so a
  case that declared `expectDrains([0, 0])` and scripted one answer drained twice, matched its cursor
  budget, ended with nothing pending and passed. Ruling 35's queue was finite in one direction only:
  `drainsPending` caught an answer left over, nothing caught a drain past the end. **Held, and
  fixed:** the fallback branch now increments `drainsUnscripted`, the `afterEach` reads and clears it
  with the other counters and asserts it zero as its fourth budget question, and a negative-control
  case (item 7 of §6) pins the counter. Counted rather than thrown, as the finding proposed, because
  a throw inside the drain is caught by the coordinator's own error handling and would surface as
  the wrong defect. Running the suite with the counter installed and before the control was added
  found **no existing case** draining past its queue: 244 of 244 passed, so the gap was open and
  unexercised.

The phase closes here — the workflow's one review per phase, blockers fixed, verification re-run; a
fix is not owed a review.
