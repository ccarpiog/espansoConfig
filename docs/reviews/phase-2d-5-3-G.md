Reviewer: autoclaude adversarial reviewer

# Phase 2d-5-3-G — round 7, scoped to 2d-5-3-F's fix

**ship-with-fixes** — 0 blockers, 3 Medium, 2 Low. The diff is comment-only.

**Medium 1 — the block asserts P and ¬P.** New text, in the paragraph opening *"A refused
`list_documents` is not that state"*: **"nothing here rests on the property"** (the property: *"its
`newest_sequence` really is a watermark for the lifecycle Rust is still holding"*). Ten lines below, the
paragraph opening *"The workspace half of the third state is driven and asserted in Rust"* says **"the
half this arm actually rests on — that the batch's `newest_sequence` still indexes the queue Rust is
holding"**. Same proposition, opposite claims. The arm calls `record(…, 'staleOpen')` and returns,
reading neither — so 2d-5-3-E's standing sentence is the false one, and `2d-5-3-E-notes.md` §8 item 2
builds a work item on it. `2d-5-3-F-notes.md` §3 asserts the opposite without naming that paragraph.

**Medium 2 — the "later open" is unnecessary.** In case 2 the batch *is* the incoming lifecycle's queue
(`WorkspaceSession::open` runs `reconciliation.begin_epoch` and `guard.replace` in one block; the queue
is a session field) and Rust still holds that lifecycle — the property holds with **no second open**. The
enumeration is short by a case for a simpler, checkable reason, and the unverified re-entrancy claim is
load-bearing on nothing. Under the fuller *"neither gone nor foreign"* reading the later open rescues
nothing either.

**Medium 3 — `2d-5-3-F-notes.md` §7 item 1 states a false absence** (*"nothing in this repository drives
two overlapping opens"*, marked actionable). `workspace.test.ts`'s **"lets the newer open win, however
late the older one answers"** does: `const pending = state.open(null); await state.open('/tmp/other');`.
The frontend half is executed; only the Rust-refusal half is not.

**Low 1 — "six" is not re-derivable.** Under 2d-5-3-D §8 item 1's criterion I count **eight** production
paragraphs (nine with `reconciliationCoordinator.test.ts`'s *"failed open leaves the previous
workspace…"*), adding the `awaitingReady()` arm's *"…may refuse at `Workspace::discover(root)?` and leave
the previous workspace installed indefinitely"* and *"What makes the refusal right in all three…"*.
`runOneDrain` has two `'staleOpen'` arms, so "three paragraphs of the `staleOpen` arm" disambiguates
several ways, each omitting a site. Asserted as enumerated in three record files.

**Low 2 — two fresh uncounted counts:** the new text's *"these three paragraphs"*, and
`2d-5-3-E-notes.md` §7's line anchors `:70-71`/`:440` (both resolve today) against the opening-words
convention D §8 item 5 records.

**Holding:** the item 4/5 renumber, all four positions;
`a_failed_reopen_keeps_the_previous_watcher_watching` refuses on a non-directory and asserts epoch 1,
ready, live edit, `#[cfg(test)]`, no `#[ignore]`; `discover(root)?` precedes `self.lock()`; `open()` has
no in-flight guard.

**NOT-VERIFIED:** every gate figure (`1320/441/2307/188`, clippy, fmt, `cargo tree`, bundle oracles) — no
`cargo`/`npm` run here, all inherited; production reachability of a second `open()` during an in-flight
drain (derived from `workspace.svelte.ts`'s two-callers comment, not executed); D §8 item 4 untouched again.
