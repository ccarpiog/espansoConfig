# Phase 2d-5-4-A — the round `CLAUDE.md` §7.1 commissioned for 2d-5-4's fix

**Status: taken and answered, and `SUPERSEDED BY 2d-5-4-B`** — never complete, because this round's
own fix changed four source files and §7.1 commissions a round for exactly that. Risk class: **high**.
Components: **none** — no `.svelte` file was modified, so no window reading is owed.

This is **not** an implementation step. §7.1: *a fix round that changes at least one source file is
owed a review round, scoped to that change.* Phase 2d-5-4's review returned `ship-with-fixes` with two
blockers and three should-fixes; the fix that answered it changed six source files; this is the round
that reviews **that fix**.

The documents: the brief [`docs/reviews/phase-2d-5-4-A.brief.md`](../reviews/phase-2d-5-4-A.brief.md),
the review [`docs/reviews/phase-2d-5-4-A.md`](../reviews/phase-2d-5-4-A.md), and the re-derivation
[`docs/reviews/phase-2d-5-4-A.rederivation.md`](../reviews/phase-2d-5-4-A.rederivation.md).

---

## 1. How the round was run

**The review was Codex**, through `autoclaude-review.sh`, which **exited 0**, so no agent was spawned
— the third consecutive Codex round on this chain. **Verdict `ship-with-fixes`, 6 findings: 2 blockers
and 4 SHOULD-FIX.**

**The report's finding bodies arrive truncated again.** The script renders each body to 180 characters
and each recommendation to 140, and it deletes its state root on success, so the full text is
unrecoverable. Every one of the six broke off mid-sentence. **Not one was accepted on the report's
strength.** The round therefore ran in three stages:

1. a **read-only re-derivation worker** (opus) derived each finding's mechanism from the source alone
   and wrote the full derivation to the `.rederivation.md` file above;
2. the **orchestrator spot-checked the decisive lines of five of the six** against the files —
   `installView`'s `views.findIndex((view) => view.id === next.id)`, `open()`'s
   `projected.push(view.value)`, `replaceSelection`'s two-line body, `repairAfter`'s uncheck-ed
   commit, the guard's arm order, and the `await readFileText()` that ends `rereadUnderGuard`;
3. a **fix worker** (opus) implemented the six fixes and pinned each one.

**All six held.** Five are defects in source. The sixth was labelled *record-only* by the reviewer and
**that label was wrong**: the same false sentence stands in source, at `observationTransitions.ts:747`.
The re-derivation caught it, and it matters under §7.1 — a record-only finding's fix commissions no
round, and this one's does.

---

## 2. Findings 1 and 2 — one defect: this module retained objects the commands built

**What was wrong.** `open()` did `projected.push(view.value)` (`workspace.svelte.ts:3462` today), so
every element of `views` was an object an **injected** command returned. Both things that run after
the final guard then read those objects:

- `installView` does `views.findIndex((view) => view.id === next.id)` — a property read on every
  retained element — **after** `invalidateProjectionOf(next.id)` has already been spent.
- `repairAfter` calls `reresolve(selected, view)`, which indexes `view.matches` and reads a
  candidate's `source_text` and `id`, and then commits `replaceSelection(found.selected)` with no
  re-check.

`CLAUDE.md` says a check and a spend separated by any property read are not atomic, because a getter
or a proxy trap runs arbitrary code and `readonly` freezes nothing at runtime. 2d-5-4's own fix had
materialized `fresh.value` once — which closed the read it was pointed at and none of these — and then
written into the JSDoc that *"what bounds that half is `replaceSelection`'s own discipline"*.

**That sentence is false.** `replaceSelection` is `selectGeneration += 1; selected = next;`. It bumps
an intent counter in the same synchronous block as the write, which cancels *asynchronous* lookups
taken earlier; it checks nothing, refuses nothing, and `repairAfter` consults it about nothing. A
synchronous re-entry from a caller's accessor was bounded by nothing at all. **A comment claiming a
guarantee the code does not give is this project's named worst defect class**, and this one had been
written by the fix round the present round exists to review.

**The fix is at ingress, not at the guard.** `ownedProjectionOf` copies a command's answer field by
field, and each of its matches field by field (`ownedMatchOf`), at **all nine** ingresses of a
command-supplied projection: `open()`, the guarded reread, the five adoptions, `adoptDiskVersion`'s
disk snapshot and the projection a selection repair carries (`ownedRepair`). Three properties of that
choice, each deliberate:

- **The construction is explicit and typed `DocumentView`**, so a *required* field added to that type
  later is a **compile error in that function** rather than a silently uncopied caller object. A
  structural clone would have given no such check — and would throw on a function-valued property.
- **The getters run once, here, before any guard is taken**, rather than between a comparison and the
  install it approved.
- **The depth is stated and bounded.** Two levels — this view's own fields and each match's own
  fields — because that is what this module reads after a guard. The JSDoc says in as many words that
  **anything deeper is still the command's own object**, and names them.

The two false claims are replaced: `rereadUnderGuard`'s JSDoc now says what actually bounds the two
post-check calls, states that saying `replaceSelection` did was false, and enumerates `installView`'s
reads including the `views` comparison it had omitted.

---

## 3. Findings 3, 4 and 5 — one defect: a status write that never asked whether it still owned the status

`noteDocumentStatus` had three writers that could not have known whether they were still entitled to
speak for a file.

**Finding 3 — the host's failure arm.** It marked `stale` before the read and, on failure, marked
`stale` again **after an await with no check at all**, overwriting a newer `removed` for a file the
window no longer holds a row for, or the cleared mark of an overlapping reread that had installed the
current bytes. Fixed by three captures compared at the write: the open generation, a per-document
`statusWrites` token (`statusWriteOf`) captured **after** this arm's own mark, and whether the window
still holds a row. **The JSDoc states what the fence makes of the write**: a permitted write can only
ever restate this arm's own mark, so no value changes — what the fence removes is every case where the
write *would* have changed one, and each of those was a write over a newer truth.

**Finding 4 — the transitions guard's top two arms.** `sequences.isNewest(document, route.sequence)`
is the only question that asks ownership and it is **third**, so `stillApplying`'s refusal and the
epoch refusal wrote `stale` over a newer `unavailable` — permanently, because a blocked session
advances the watermark and the observation is never redelivered. **The decision order is unchanged**:
`stillApplying` is still first, because the arm below it fires a component's callback and that is
2d-5-4's blocker 2. What changed is that those two arms write through `markStaleWhileOurs`, which asks
the ownership question at the write. The two arms **below** `isNewest` write directly and are fenced by
position: a call that can never refuse is one no test can tell from no call, and a draft case written
against one of them passed both ways, which is how that was established rather than argued.

**Finding 5 — nothing on the explicit-reread path cleared anything.** The only clear lived in the
coordinator's guard, and `BrowserState.rereadDocument` is `rereadUnderGuard(document,
ALWAYS_PERMITTED)`, so a person using the recovery control on a file a failed guarded reread had
marked read it successfully from disk and **the mark stayed for the rest of the session**. Fixed by
moving the clear out of the guard and into the installation block, which is the one place that knows
an installation really happened and the one place both callers pass through.

**What the clear claims, and what it does not.** It claims *this file's content is current as of this
read*. It does **not** claim that a session blocked by lost history has reconciled its **membership** —
that is not a per-document fact, no per-document code could carry it, and 2d-6 draws it. The
coordinator's guard refusing on `stillApplying` is what keeps a blocked session's own rereads from
reaching the line at all; an explicit reread reaches it and says only the narrow thing. **No arm that
refuses clears anything**, and moving the clear here made that structural rather than argued: there is
one clear, it is after the installation, and every refusal returns before it.

---

## 4. Finding 6 — a reachability claim false in the record *and* in source

§3.5 of `2d-5-4-notes.md` and `observationTransitions.ts:747` both said the reread is the only
open-workspace document command `applyObservation` can reach. It is false: `rereadUnderGuard` ends with
`await readFileText()`, which sends `document_text` when the raw viewer has a target, and
`removeDocument` fires the same refresh because a removal can take the viewer's file with it.

Both are corrected, and both now separate **the command this arbitration requests** from **what is
reachable transitively**. Two things the correction does not disturb: ruling 27's *no save command is
reachable at all* — `ReconciliationWorkspace` has none — and ruling 28, because the identity the
viewer read is sent for is the viewer target's, which `fileTextTarget()` subtracts `pendingAdditions`
from.

---

## 5. What this round deliberately did not do

- **No user-facing string in any language**, so no dictionary key and no i18n parity question.
- **No `.svelte` file**, so no window reading is owed.
- **No Rust.** `git diff --numstat -- crates/ src-tauri/` names only the instrument's `main.rs` hook.
- **No new module.** `ownedProjectionOf` lives in `workspace.svelte.ts` beside the state it protects,
  so the ladder's *one module per new source module* rule predicts no movement in `npm run build` and
  none happened.

---

## 6. The gates

Measured in full by the orchestrator on the post-fix tree, each command run on its own:

- `cargo test --workspace -- --test-threads=1` → exit 0, **26** `test result` lines, **1320** passed,
  and **no line lacking `0 failed`** — the complementary question, because a sum can be right while a
  binary is silent. Read from a file rather than through a pipe. First attempt.
- `cargo clippy --workspace --all-targets -- -D warnings` → exit 0; `cargo fmt --check` → exit 0;
  `cargo tree -p espansoconfig-core | rg tauri` → finds nothing.
- `npm run check` → **443 files, 0 errors, 0 warnings**, exit 0.
- `npm test` → **2389 passed in 61 files**, exit 0 (2380 before).
- `npm run build` → **189 modules**. Both bundle oracles read: `$$payload|head_payload|push_element`
  **absent**, `window.__svelte|svelte-trusted-html` **present (2)**.
- The instrument's pin: `git diff --stat` over `src-tauri/src/main.rs` and `src/main.ts` is
  `5 insertions(+), 1 deletion(-)`.

**The nine cases and the failure each produced against the pre-fix code.** Every one was confirmed by
reverting the change in the tree, running the one suite, recording the message and restoring it:

| Fix | The case | What it said before the fix |
|---|---|---|
| 1 | `workspace.test.ts` — *installs into the slot the projection names, whatever a retained view says* | `expected [ 2, 2, 3 ] to deeply equal [ 1, 2, 3 ]` |
| 2 | `workspace.test.ts` — *repairs the selection against the projection it read, not a re-entrant one* | `expected { id: { document: 2, …(2) }, …(3) } to be null` |
| 3 | `workspace.test.ts` — *keeps a newer removal over an older reread that came back a failure* | `expected { kind: 'stale' } to deeply equal { kind: 'removed' }` |
| 3 | `workspace.test.ts` — *keeps an overlapping reread's installed status over an older failure* | `expected { kind: 'stale' } to be null` |
| 4 | `observationTransitions.test.ts` — *preserves a newer unreadable reason when the session has stopped applying*, and the same for a moved epoch | both `expected [ …(3) ] to deeply equal [ …(2) ]`, the third entry being the `stale` appended over the `unavailable` |
| 5 | `workspace.test.ts` — *clears the mark when an explicit reread installs the file again* | `expected { kind: 'stale' } to be null` |
| 5 | `observationTransitions.test.ts` — *permits the install and writes no status of its own* | `expected [ { document: 1, status: null } ] to deeply equal []` |

**Two candidate cases were discarded for passing both ways**, and that is the check the confirmation
exists to make rather than an inconvenience: a fence on the guard's registry arm cannot discriminate,
because `isNewest` returns first — which is the positional argument of §3 stated as a measurement —
and finding 6 has **no behavioural delta** at all, being two false sentences. The case that replaced
the first is labelled non-discriminating by construction; finding 6's is stated as pinning the
corrected claim, not as a regression test.

---

## 7. Where it is thin

Every item carries one of §7.3's two marks. **No item commissions a round** — §7.1 is the only
mechanism and it reads a diff — and **none of the items below names an unfixed correctness defect in a
source file**, so none holds this step open.

1. **actionable** — `ownedProjectionOf`'s JSDoc enumerates what this module reads after a guard, and
   the two-level depth is justified *by* that enumeration. The enumeration was derived by reading the
   three call sites; nothing checks it. A reader added later — a fourth thing running after a guard —
   makes the sentence false without making any test fail. The check that would bite is a sweep of
   every statement between a `stillCurrent()` and the end of its block.
2. **actionable** — a field-by-field copy makes a **required** field's omission a compile error and an
   **optional** field's omission nothing at all. `DocumentView` and `MatchView` are wire types; if
   either ever gains an optional field, `ownedProjectionOf` will silently stop copying it. The JSDoc
   does not draw that distinction.
3. **recorded only** — `markStaleWhileOurs` calls `sequences.isNewest`, and the new comment calls that
   a pure read. It is a read of a `Map` this module owns today. Nothing in the type says it must stay
   one, and a future accepted-sequence store with a getter would put a callback back inside a guard.
4. **actionable** — the fence in the host's failure arm permits only writes that restate its own mark,
   which means **no test can distinguish the permitted write from no write at all**. The three cases
   that pin it all drive the *refusal*. The write is kept because of what the arm promises, not
   because anything observes it.
5. **recorded only** — the clear's disclaimer about membership is a sentence, not a type. A blocked
   session's per-document marks are cleared by any successful explicit reread, and what stops that
   from meaning *reconciled* is that nothing draws per-document status yet. 2d-6 is where the
   distinction becomes visible, and where getting it wrong would show.
6. **recorded only** — `repairAfter` still reads `next.matches` elements **after** the installation,
   and the guarantee that those are module-owned now comes from `ownedProjectionOf` running at every
   ingress. That is nine call sites holding one invariant, enforced by review and by the normalizer's
   own JSDoc; **no type expresses it**, and a tenth ingress added later would not fail to compile.
7. **recorded only** — this round changed no `.svelte` file and so takes no window reading, but the
   behaviour it changed — when a file is marked stale and when the mark clears — is exactly what 2d-6
   will draw. The first reading that draws it is the first evidence any of this is right on a screen.
