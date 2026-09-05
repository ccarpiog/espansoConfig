Reviewer: autoclaude adversarial reviewer

# Phase 2d-5-3-C — the round §7.1 commissioned for 2d-5-3-B's fix

**Verdict: ship-with-fixes, 0 blockers.** Scope: commit `337a6f6`.

## Medium 1 — the rewrite names two orders; a third state falsifies its justification

`src/lib/browser/reconciliationCoordinator.ts:750-757` (`staleOpen` arm):

> *"What makes the refusal right in both orders is the generation alone: this drain was issued under
> one this session has left, so its `newest_sequence` is not a watermark for the lifecycle now
> installed … a queue that is either gone or not yet this session's to count from."*

`open()` bumps the generation unconditionally (`workspace.svelte.ts:2554`), and
`WorkspaceSession::open` returns from `Workspace::discover(root)?` (`commands.rs:683`) **before it
takes the lock** — its own doc: *"A failure leaves the previously open workspace in place."* So under
a refused `open_workspace` (`workspace.svelte.ts:2607`) or a refused `list_documents` (`:2625`), the
batch is the queue of a lifecycle that is **still installed**: not gone, not foreign, and its
`newest_sequence` *is* a watermark for it. Action still right (the window cleared its cursor at
`workspaceOpened()`); the nominated reason is false — the exact shape 2d-5-3-B raised against
2d-5-3-A. Same defect at `:770` (*"whichever of the two the batch turned out to describe"*) and
`:940` (*"describing **one of two** lifecycles"*). Not obscure: the failed open is what
`workspace.test.ts:7591` tests and what this round's own §3.2 measured.

## Medium 2 — the correction against stale citations is stale in its own commit

`docs/decisions/2d-5-3-A-notes.md` §3.1 correction cites `reconciliationCoordinator.ts:979`; on the
tree the same commit produced, that comment is at **:995** — moved by the commit's own +19 lines.
Verified `:979` was right at `1a135fd`.

## Low

1. `reconciliationCoordinator.ts:1051` is 112 chars — the only line >90 in the file, left unwrapped by
   the rewrite. No formatter config exists to catch it.
2. Attribution split inside one commit: notes §3.1 credits `2d-4b-D`, the correction block and the
   commit message credit `2d-5-2b-D`. Both phases exist and both notes files record stale-citation
   findings, so *"twice"* is unverified either way.
3. Out of scope, pre-existing: `commands.rs:1446` doc says *"The three backup-catalogue methods above
   are its only customers"*; `drain_external_changes` (`:1353`) is a fourth — a false comment on the
   citation this round traced.

## Verified by running or reading

Both Rust citations (`:3491`, `:682`) correct; `with_workspace_read` and `open` take the same
`self.open` mutex. Diff is comment-only (0 non-comment, non-blank changed lines, mechanically
filtered). §3.1's replacement `rg` recipe returns exactly one line (`workspace.svelte.ts:3506`);
`:1891` reads *"Created here, started by nobody."* Assertions at `:7616`/`:7624` confirmed; the two
mutations are different, so no contradiction. `workspaceOpened()`'s sufficiency holds against
`accept()` (`:660`) and `onWake()` (`:922`). `npm run build` = 188 modules.

## NOT-VERIFIED

`cargo test` (forbidden by brief); `npm test` 2307 and `npm run check` 441 not re-run (budget). The
`:7624` mutation not re-run — read-only; derived from code instead. Whether a losing drain seeding the
new queue's `acknowledged` (`reconciliation.rs:1186`) with the old watermark is harmful. Sections 5+
of `2d-5-3-B-notes.md` skimmed only. Scope extension to three sites accepted; note Medium 1 lands on
two of them.
