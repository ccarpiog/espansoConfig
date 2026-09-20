# Review brief — Phase 2d-5-4-C, the round `CLAUDE.md` §7.1 commissions for 2d-5-4-B's fix

## Repository

`/Users/ccarpio/Developer/Utils/espansoConfig`, branch `main`. Read `CLAUDE.md` at the root first —
it is binding, and its §5 (conventions), §7 (review rounds and their marks) and its paragraphs on
decision records that overclaim are the standards this review applies.

**The change under review is COMMITTED**, at `834ed1b` (*Phase 2d-5-4-B — the round 2d-5-4-A's fix
commissioned, and the round its own fix commissions*). The working tree is clean apart from four
deliberate instrument paths named at the bottom of this brief; **they are not the change under review
and are never findings**. Read the committed files at HEAD; `git show 834ed1b -- <path>` shows a
file's whole phase diff.

## What this round is, and what it is not

This is **not** a new implementation step. `CLAUDE.md` §7.1: *a fix round that changes at least one
source file is owed a review round, scoped to that change*. Phase 2d-5-4-B was itself such a round
(Codex, `ship-with-fixes`, 2 blockers + 4 should-fix, all six re-derived and all six holding, plus
three more its own re-derivation found that the review had missed); its fix changed **four source
files**, and this round reviews that fix. Its own fix, by the same rule, decides whether another round
follows — by whether it touches a source file, never by the severity of what it found.

**The fix round is not a separate commit**: it landed inside `834ed1b`. It is therefore identified
here by **region**, from `docs/decisions/2d-5-4-B-notes.md` §2, §3, §3a, §4 and §5, which is the
record of what each finding changed.

## The fix round's scope, region by region

Four source files. Every line and symbol below is what the fix round wrote or rewrote; line numbers
are HEAD's and are a starting point, not a boundary.

**1. `src/lib/browser/workspace.svelte.ts`**

- **The second generation check in `open()`, at ~3650–3664** — finding 1's fix. The per-iteration
  check at ~3629 cannot cover the *last* document, whose `ownedProjectionOf` field reads and whose
  injected `report` run with no next iteration behind them; the new check sits after the loop and
  before `views = projected; loadFailures = refused; status = 'ready';` and
  `reconciliation.workspaceReady()` at ~3677. The long comment above it is part of the fix and is
  in scope as prose.
- **`ownedMatchIdOf` (498–504) and `ownedIdentityOf` (517–519)** — finding 2's fix. `ownedMatchOf`
  (543–564) no longer keeps `id: match.id`; the three adoptions copy the `target` and `moved`
  identities a save answer carries, at **4666, 4667, 4740 and 4815**, each at the adoption's first
  statement and before its only `await`.
- **`ownedSummaryOf` (688–698)** — finding 4's fix, applied at **both** `DocumentSummary` ingresses,
  **2840** and **3600**. The record calls `DocumentSummary` a whole unnormalized ingress class the
  review did not name, with four readers, one of them inside the observation guard.
- **`statusWriteOf` (2937–2939) and the fence in `rereadUnderGuard`** — finding 3's fix (§3a). The
  explicit reread's **clear** is fenced by a fourth capture; the **install** is deliberately left
  unfenced, and the comment argues the window is never worse off for that.
- **`ownedProjectionOf` (629–660) and `ownedRepair` (717–734)** inherited from 2d-5-4-A, whose
  headers this round re-worded.

**2. `src/lib/browser/observationTransitions.ts`**

- **`markStaleWhileOurs` (888–893) passed as a parameter into `tellTheSurfaceAbout`** — finding 5's
  fix. It is now reached from **two** call sites (901 and 984) and **four** arms (974, 978, 984's
  callback, 996); the guard's two lower `stale` writes were routed through it and the **positional**
  justification — *reaching this line means the ownership question two arms up already answered yes* —
  was deleted, including the clause claiming no test could tell the fence from its absence.

**3–4. The two suites** — `workspace.test.ts` and `observationTransitions.test.ts`. **Six** new cases
net, each confirmed to fail against the pre-fix code by reverting the change, running the one suite
and restoring it; the messages are in `docs/decisions/2d-5-4-B-notes.md` §10.

**Also in scope: `docs/decisions/2d-5-4-B-notes.md` in full**, its §11 *where it is thin* marks
included, and **the correction blocks this round wrote into `docs/decisions/2d-5-4-notes.md` and
`docs/decisions/2d-5-4-A-notes.md`** — one of which **re-marks an item from *recorded only* to a
blocker** (§7 of the notes), and one of which says `2d-5-4-A-notes.md` §6's *"cannot discriminate"*
claim is disproved by finding 5.

## Where a finding has lived in every tail this project has run

Point the review at these first. Each is the fix that answered a finding, which is exactly where the
next finding has been found here.

1. **The second generation check in `open()`.** It catches the last document's accessors. Does it
   catch **everything** between the loop and `workspaceReady()`? Three assignments and a call run
   after it — `views`, `loadFailures`, `status`, then `reconciliation.workspaceReady()` — and
   `reconciliation` is injected. Is any of those four a site where caller or host code runs *after*
   the check it is supposed to be covered by? And is the comment's account of **why** the
   per-iteration check is insufficient true of the code as written, including its claim about what
   the failure arm does?
2. **`ownedMatchIdOf`'s fields against `MatchId`, and `ownedSummaryOf`'s against `DocumentSummary`.**
   Both claim the compile-error property `ownedProjectionOf` claims, and both carry the same
   **optional-member** caveat: an optional property omitted from an object literal is not a TypeScript
   error, so the guarantee holds for required fields and may not hold for the rest. Check the actual
   declared shapes. Then the second half: **is a further ingress class still unnormalized?** A
   `SaveResult`, a `ConflictModel.source`, a restore-catalogue row, a `RawSaveOutcome`. The
   re-derivation swept `DocumentView` and found nine ingresses and no tenth, and swept
   `DocumentSummary` and found two; **nobody has swept the others**. Sweep by shape — every value that
   crosses the `commands` boundary and is then read after a guard — never by the line numbers above.
3. **The clear's fence, and the install left unfenced.** The comment argues the window is never worse
   off. Is that true when the newer observation is a **`Removed`** rather than an `Unreadable`, and
   when `repairAfter(next)` runs immediately afterwards over a projection the newer truth contradicts?
   Is there still a path that marks and never clears, or one that clears a mark it did not set?
4. **`markStaleWhileOurs` as a parameter.** Two call sites, four arms. Does every arm that writes
   still hold the ownership answer it needs; does the hoisted closure capture the same `route.sequence`
   at both call sites; and can a writer reach `noteDocumentStatus` **beside** it rather than through
   it? (§11 item 6 says the single-writer property is a convention and not a type — check whether it
   is even a convention that holds today.)
5. **The three correction blocks, and `§3a`.** A correction block is a source of new false claims in
   this project's history: three of 2c-3a-1's ten findings were regressions a previous round's fix
   introduced. Check each block against the code it describes. One **re-marks an item from *recorded
   only* to a blocker** — check that what replaced the struck text is true, and that **no narrower
   wording of the struck claim survives anywhere**; 2c-4a-3a's round 2 found exactly that, and this
   round's worker reports having swept for it in two further places. `§3a` is numbered out of order on
   purpose (renumbering would falsify twenty cross-references) — check the file's own cross-references
   against it.

Two standing shapes to sweep for, **by shape and never by the words of a past finding**:

- **A consuming operation whose result is discarded**, and a check and a spend separated by any
  property read — this project has shipped that twice in one phase. `readonly` freezes nothing at
  runtime and a getter or a proxy trap runs arbitrary code. Every capture-then-compare token in this
  fix is a new instance of the shape: check that each capture is taken **after** the arm's own mark
  and that nothing between a capture and its comparison can run caller code.
- **A comment asserting a contract the code does not give.** The fourteen-round 2d-5-3 tail was
  entirely about whether comments tell the truth; no test can fail one. Check `file:line` citations
  resolve — four stale cross-file citations under `src/` are a known open class here.

## Verification already run — do not re-run

The ladder's live rung, measured in full at 2d-5-4-B on this exact tree:

- `cargo test --workspace -- --test-threads=1` → **1320**, summed over **26** `test result` lines and
  checked by the complementary question (no line lacking `0 failed`). No Rust changed.
- `cargo clippy --workspace --all-targets -- -D warnings` → exit 0; `cargo fmt --check` → exit 0;
  `cargo tree -p espansoconfig-core | rg tauri` → finds nothing.
- `npm run check` → **443 files, 0 errors, 0 warnings**.
- `npm test` → **2395 tests**, exit 0.
- `npm run build` → **189 modules**; both bundle oracles read — server-only markers absent,
  client-only markers present (2).

**⛔️ Run no build, test, package or `cargo` command of any kind.** `cargo test --workspace` is flaky
on this host and a concurrent run has failed here before. Read the code.

## Known and declared, not findings

- The four uncommitted instrument paths — `src-tauri/src/probe.rs`, `src/probe.ts`, and two hook
  lines each in `src-tauri/src/main.rs` and `src/main.ts` — are the temporary window-reading
  instrument. They are deliberate, never committed, and a later step deletes them. `git diff --stat`
  over the two hook files is `5 insertions(+), 1 deletion(-)`.
- 2d-5-4-B added **no user-facing string in any language** and touched **no `.svelte` file**, so no
  window reading is owed. A round that disagrees should say so; the remedy would be a reading, not a
  revert.
- The two things 2d-5-4 hands forward on purpose are still handed forward: a removed target ships as
  state and not as telling (2d-5-5's), and the unbounded blocked-drop is restated rather than fixed.
  Say if either is wrong to hand forward, not merely that it is handed forward.
- **`docs/decisions/2d-5-4-B-notes.md` §11 is a record, not a work list** (§7.3). Its eight items are
  the previous round's own nomination of where it is thin; read them, and treat item 2 — the only
  **actionable** one — as a check worth running rather than as a defect already established.

## Output

Write the full report to **`docs/reviews/phase-2d-5-4-C.md`**. Give a verdict line
(`ship-with-fixes` / `do-not-ship` / `ready`), a blocker count, and each finding with its severity,
its file and line, and enough derivation that the orchestrator can **re-derive it without you** —
every finding here is re-derived from the code before it is accepted, and reviewers' arithmetic has
been wrong in several of the last rounds. Say explicitly when a finding is about the **record** rather
than about source: under §7.1 that distinction decides whether another round runs.

Time budget: 25 minutes.
