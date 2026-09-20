Reviewer: autoclaude adversarial reviewer

Tree measured: working tree at HEAD `26fa26a` (the three files in scope are byte-identical to
`aa025fa`), plus `git show 3428cde:…` and `git show eec0b70:…` for the anchor re-derivations.

## Findings

**1 (SHOULD-FIX, Medium) — the new summary sentence attributes to both tests what its own next
sentence denies of one.** `src/lib/browser/reconciliationCoordinator.ts:790-791`:

> `// stops one. **The two tests that come nearest drive that overlap somewhere`
> `// other than Rust, and nothing wider is claimed here.**`

"That overlap" is the preceding sentence's *an open landing while this drain is in flight*. Lines
793-794 then say of the first test: *"overlaps two **opens** with each other and issues no drain at
all"* — a test with no drain drives that overlap nowhere, not "somewhere other than Rust". The
replaced text (`git show aa025fa`, old lines) called it a near-miss and did not predicate driving of
it; the rewrite does. Fix: predicate the driving of the coordinator test only (e.g. *"The nearest
test that drives that overlap drives it on the injected host; the nearest host test does not drive
it at all"*). 2d-5-3-K-notes §7 item 1 records the unpinnable half ("which two tests come nearest")
and not this half.

**2 (SHOULD-FIX, Low/Medium) — `workspaceReady()`'s body is two statements, and the omitted one is
the gate.** Source comment, line 796-797: *"reaches `workspaceReady()`, whose body is a
`requestDrain('workspaceOpened')`"*. The body (same file, 1166-1172) is `openInProgress = false;`
**then** `requestDrain('workspaceOpened')`, and that file's own comment at 1167-1168 calls the
cleared gate what makes the request *"the flush"*. `2d-5-3-K-notes.md` §2 states the two-statement
body correctly, so source and record disagree; the same short form is in the first correction block
of `docs/decisions/2d-5-3-J-notes.md:56`.

## Checked and found true (not findings)

Unconditional `createReconciliationCoordinator` at `workspace.svelte.ts:1896`; `workspaceOpened()`
at 2569 before the first await (2603); winner reaches `workspaceReady()` (2677 `status = 'ready'` is
asserted by the test at `workspace.test.ts:1244`, and 2687 follows unconditionally); loser returns at
2604-2606; no `start()` in that test (1229-1253), so `drainMayStart()` (620-622) is false and
`requestDrain` (1059-1069) remembers. `self.reconciliation.begin_epoch` occurs once,
`commands.rs:707`, inside the swap block 686-718, below `Workspace::discover(root)?` at 683 — so
"the swap block that early return skips" is true and its antecedent ("that same early return", 764)
is unambiguous. Both Rust doc quotations verbatim modulo emphasis (`commands.rs:625-627`, `:680`,
the latter in `# Errors`). §3's four anchors re-derived: 797 / 818 / 812 on `3428cde`, 800 on
`eec0b70`, `it(` on test line 749 with `describe` on 748 — all four as the notes say. The four
opening-words anchors resolve to exactly one paragraph each (743, 752, 810, 842). No third frontend
test drives an open during an in-flight drain: all eleven `the reconciliation lifecycle` tests
(`workspace.test.ts:7535-7790`) settle each drain before the next open.

VERDICT: ship-with-fixes
BLOCKERS: none
SHOULD-FIX: src/lib/browser/reconciliationCoordinator.ts:790-791 — "The two tests that come nearest
drive that overlap somewhere other than Rust" predicates driving of both tests, and lines 793-794
say the first "issues no drain at all", so it drives that overlap nowhere; restate so only the
coordinator test is said to drive it. src/lib/browser/reconciliationCoordinator.ts:796-797 — "whose
body is a `requestDrain('workspaceOpened')`" omits `openInProgress = false`, the gate-opening
statement the same file (1167-1168) makes load-bearing and that 2d-5-3-K-notes §2 states in full;
same short form at docs/decisions/2d-5-3-J-notes.md:56.
NOT-VERIFIED: no build, test, lint, cargo or npm command was run, by the brief's hard rule — the
gate figures (1320 / 441 / 2307 / 188, 26 `test result` lines, both bundle oracles, the 90-character
and comment-only mechanical proofs) are unre-derived here. The Rust-side universal behind §2 ("every
`session.drain_external_changes(...)` in that file's tests is synchronous, no `thread::spawn` among
them") was not re-swept; only the frontend "nearest test" question was. "Which two tests come
nearest" remains unpinnable by any check in the repository, as §7 item 1 says.
