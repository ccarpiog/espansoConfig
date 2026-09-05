Reviewer: autoclaude adversarial reviewer

Scope: `85181ac`, source only — `reconciliationCoordinator.ts`, `commands.rs` — plus record claims
repeating them.

## Medium 1 — source. A refused `list_documents` does not leave the previous workspace installed

staleOpen arm, third paragraph: *"a refused `open_workspace`, or a refused `list_documents` after it,
leaves the **previous** workspace installed and its queue untouched, which that function's own doc
comment states in as many words."*

`workspace.svelte.ts` returns on `!opened.ok` **before** calling `listDocuments()`, so a refused
`list_documents` implies `open_workspace` succeeded: `WorkspaceSession::open` (commands.rs:682) already
ran `reconciliation.begin_epoch(...)` and `guard.replace(Open { .. })` in one session-lock block. The
**new** workspace is installed and the queue reset to `QueueState::empty`. Nothing restores `None`
(`guard.replace` is the only writer), so `documents()` cannot refuse after a successful open. And
`open`'s doc — *"A failure leaves the previously open workspace in place"* — says that of **itself**,
never of `list_documents`. The frontend's own `!listed.ok` comment claims only the gate; this one does
not. Same sentence in `2d-5-3-C-notes.md` §1.

## Medium 2 — source. The `awaitingReady()` arm's new reason is false at that arm

New text: *"this drain was issued under a generation this session has left"*. That arm is reached only
when `openedAt === host.openGeneration()`; the arm above returns for exactly the case where the
generation moved, and this arm's own opening sentence says the two checks are not the same question.
The pre-fix wording (*"for a lifecycle this session has left"*) did not carry this. The fix introduced it.

## Medium 3 — source + record. Stale coverage citation

*"`./workspace.test.ts`'s failed-open case drives exactly that state."* That case (:7591) scripts
`open: { ok: false }` for its **only** open — so no workspace was ever open, the "gone" state, not
"previous still installed" — and asserts `drainSequences` stays `[0]`: no batch reaches this arm. A
scripted-command vitest drives no Rust state.

## Low — mutex-race framing vs. this crate's own threading doc

commands.rs *"Why every command is synchronous"*: non-async commands run **on the main thread**. Two
sync commands never contend for the session mutex; the order is the dispatcher's. Notes §5 reason 1
(*"blocked on the session mutex … acquires it on release"*) describes a two-thread block that doc
excludes.

## Cross-epoch watermark — narrowed, not settled

Read: `drain`'s `acknowledged.max(after_sequence)` is unconditional and epoch-blind; `begin_epoch` runs
under the session lock, so a losing drain applies a stale watermark to a **fresh** queue; sequences
restart per epoch at `FIRST_OBSERVATION_SEQUENCE = 1` (ledger.rs:576, :1218), so a stale W>0 makes the
new epoch's first W observations refused and counted. Unsettled: whether the losing order occurs — under
the main-thread model that is IPC dispatch order, unreadable here.

## Verified clean

`with_workspace_read`: exactly four callers (1282/1294/1308/1357); its rewritten doc holds — `drain`
mutates only the queue. Every re-derived citation holds on this tree (`:682`, `:683`, `:1353`, `:1451`,
`:3496`, `workspace.svelte.ts:3506`, `reconciliationCoordinator.ts:1014`); `rg '\.start\(\)' src --glob
'!*.test.ts'` matches two. `requestDrain()` and `workspaceOpened()` rewrites are true of the Rust.

## NOT-VERIFIED

Gates (orchestrator's, per brief). Tauri's real command scheduling. The able-to-fail claims and the
§8.3 transcript — unreproduced.
