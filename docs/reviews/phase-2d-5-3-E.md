Reviewer: autoclaude adversarial reviewer

# Phase 2d-5-3-E — review of 2d-5-3-D's fix (`c4a428c`)

**ship-with-fixes. 0 blockers, 2 Medium, 0 Low.** Comment-only verified mechanically: no changed line
in `git diff 85181ac c4a428c -- src/lib/browser/reconciliationCoordinator.ts` fails to start `//`;
numstat `33 11`. Both Mediums are claims this fix introduced.

## Medium 1 — `reconciliationCoordinator.ts:775-781`

Claims *"**Nothing in this repository drives the third state, and nothing here could** … So an edit
to that early return falsifies this paragraph with every gate in the project green."*

`src-tauri/src/watch_check.rs:513` `a_failed_reopen_keeps_the_previous_watcher_watching` opens a real
tree, refuses a second open (`:521-524`), then asserts `watch_status().expect("the workspace stayed
open")`, `assert_eq!(status.epoch, 1, "a failed open must not replace the watcher")`, `status.ready`,
and a live edit delivered at epoch 1 — the third state's *workspace* half, driven and asserted.
`mod watch_check;` is `main.rs:177`; no `#[ignore]`, no feature gate. Any edit to that early return
stopping a refused open from leaving the previous workspace installed turns that test **red**. Only
the *queue* half is unpinned: the test never drains.

Replacement: "…nothing here could; in Rust, `watch_check.rs`'s
`a_failed_reopen_keeps_the_previous_watcher_watching` pins the kept workspace, its watcher and its
epoch, so an edit to that early return turns that test red. What nothing pins is the **queue** half."

## Medium 2 — `reconciliationCoordinator.ts:768-774`

Claims a refused `list_documents` *"**is** the incoming-lifecycle case above … not this one."* The
arm above (`:743-750`) separates states 1 and 2 by the lock race — *"win, and the batch is the
outgoing queue; lose, and `open`'s swap block has already run"* — with `drain_external_changes`
reaching that mutex via `with_workspace_read` (`commands.rs:1451-1461`) against the swap
(`commands.rs:686-719`). A refused `list_documents` establishes only that the swap ran
(`workspace.svelte.ts:2607-2624` returns on `!opened.ok` first). The in-flight drain may have taken
the lock **before** it — state 1. Right that it is not state 3, wrong that it is state 2.

Replacement: "…so the batch is one of the first two cases, whichever the lock race gave it, and never
this one."

Both sentences propagate to `2d-5-3-D-notes.md` §1/§3, `2d-5-3-C-notes.md` §1, `PROGRESS.md` row 148
and Next-action, `next-action-history.md` — record, so §7.1 commissions nothing for those.

## Checked and standing

`awaitingReady()`'s premise is true at its arm (reached only when `openedAt ===
host.openGeneration()`, `:733`); `batch.epoch` is read below either way (`:817`, `:661-668`).
`discover` is outside the lock, `begin_epoch` and `guard.replace` are one block, `guard.replace`
(`:713`) is the slot's only writer. `workspace.test.ts:7591` scripts one `open:{ok:false}` and holds
`drainSequences` at `[0]`. No `pub async fn` in `commands.rs`. All five anchors still resolve after
the rewording. Figures match: `PROGRESS.md` 761 lines/100,986 bytes, `a29c544` 758, `9bbcbf4`
788/98,661; no line over 90 chars; the harness-free quadruple is stated as a prediction (`:561`).

## Where it is thin

1. Both Mediums are correctness defects in **source** comments — *actionable*, blockers under §7.3
   unless fixed in this round's fix.
2. No gate reads these paragraphs, and this fix widened the claim to five — *recorded only*.
3. Tauri dispatch order and the cross-epoch watermark are untouched here — *recorded only*.
4. Record propagation was found by grep, not by end-to-end reading — *recorded only*.

## NOT-VERIFIED

`cargo test --workspace` not re-run (brief forbids; `watch_check` scar). npm gates not re-run —
comment-only diff. Tauri scheduling unreadable here. The "five comment paragraphs" count was not
enumerated.
