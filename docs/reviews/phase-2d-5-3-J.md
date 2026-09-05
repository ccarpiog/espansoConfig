Reviewer: autoclaude adversarial reviewer

# Phase 2d-5-3-J — round 10 of the `reconciliationCoordinator.ts` tail

Scope: commit `eec0b70`'s four rewritten passages, `2d-5-3-I-notes.md`, the `PROGRESS.md` archive
correction. No build/test/package command run, per the brief.

## SHOULD-FIX 1 (Medium) — the added clause "it pins that the overlap is reachable" pins nothing

`src/lib/browser/reconciliationCoordinator.ts:783-785`. **Re-derived against the code.** The sentence's
proposition is *"a further successful open may have installed another lifecycle and emptied the queue
**by then**"* — i.e. an open landing while **this drain's await** is outstanding. The cited test,
`src/lib/browser/workspace.test.ts:1229`, **never calls `state.start()`**, so `reconciliation.start()`
(`workspace.svelte.ts:3502-3506`) never runs and `drainExternalChanges` is never invoked: `drainSequences`
assertions begin only at `workspace.test.ts:7558`. The test contains **no drain**. So "the overlap" is
either its nearest antecedent, *two overlapping opens* — in which case the clause is vacuous, the test
pins that what it drives is reachable — or the overlap the paragraph needs, which it does not pin.
2d-5-3-I added this clause; the pre-fix text merely said the test *drives* two overlapping opens, which
was true. The site that does pin open-during-drain is `reconciliationCoordinator.test.ts:757-763`
(`control.generation += 1; coordinator.workspaceOpened()` with one drain in flight → `'staleOpen'`), and
the block never cites it. **Fix:** drop "it pins that the overlap is reachable", keep "pins nothing about
Rust", or cite `reconciliationCoordinator.test.ts:763`.

## SHOULD-FIX 2 (Medium) — "which that function's own doc comment states in as many words" is false of the queue half

`reconciliationCoordinator.ts:755-757`: *"a refused `open_workspace` leaves the **previous** workspace
installed **and its queue untouched**, which that function's own doc comment states in as many words."*
**Re-derived.** `src-tauri/src/commands.rs:679-681` states only *"**A failure leaves the previously open
workspace in place**"*. The sole queue sentence in that doc comment, `commands.rs:650-651`, says the queue
is *emptied* in the swap block and says nothing about a failure. The proposition is true; the attribution
is not. The fix sharpened this into a contradiction: `:797-798` now says only the **workspace** half is
Rust-backed, and `:802-804` says the queue half is *"asserted in prose and rested on by nothing here"* by
that paragraph *"and by that one alone"* — while that paragraph credits it to a Rust doc comment. One
block, proposition and negation (2d-5-3-G Medium 1's shape). **Fix:** scope the attribution to the
workspace half.

## SHOULD-FIX 3 (Low) — the fix's own positional deictic, and a doubled "so"

`:812` adds *"the falsifying edit named **at the end of this paragraph**"* — a forward positional deictic
six lines under `:805-806`, which declares this comment names sites *"by its opening words rather than
saying the paragraph above"*. It resolves (`:819-820`), so Low, not Medium; `:814`'s *"the one below"*
sits in the same sentence pair that names the other paragraph by opening words. Separately `:796-798`
reads *"so a change … turns that test **red**, so the **workspace** half …"* — the fix replaced "and" with
a second "so". **Re-derived by reading.** **Fix:** anchor by opening words; restore "and".

## Verified clean

- `:832` anchor resolves — `:735` opens *"An `open()` landed while this was in flight"*.
- `watch_check.rs:514-541` supports the workspace half exactly as `:791-799` claims (epoch 1, ready, live
  edit after a refused open).
- `commands.rs:682-683` (`Workspace::discover(root)?` before the lock) and `reconciliation.rs:1029-1031`
  (`QueueState::empty`) support the third-state and "emptied the queue" claims.
- Notes §5's sweep table: `git show 8e457d1:…` returns **exactly six** sites at `:740,:773,:783,:795,:803,:824`
  — the table is accurate; four remain in the working tree.
- The `PROGRESS.md` 2d-5-3-H row now names three archives, consistent with that round's header.

## Where it is thin

1. **actionable** — SHOULD-FIX 1 and 2 name correctness defects in a source file (`reconciliationCoordinator.ts`).
   Fix now, or hold `BLOCKED`.
2. **recorded only** — archive line figures (123 / 55 / 80) in `PROGRESS.md` and the notes were not
   counted against `docs/progress-archive/`.
3. **recorded only** — no gate re-run this round; the brief prohibited it. All four figures are evidence
   about code, not about any finding above.
4. **recorded only** — `commands.rs` outside `open()`, `begin_epoch` and the doc comment remains unread by
   this tail; 2d-5-3-D §8 item 4 still unreproduced; the `ReconciliationQueue::drain` watermark carry
   (`reconciliation.rs`) is out of scope and untouched, owned by 2d-5-5.
5. **recorded only** — `:800-801`'s *"no scripted-command suite … drives Rust at all — **its** failed-open
   case"* has a singular possessive over a negated plural. Pre-existing, prose only.
