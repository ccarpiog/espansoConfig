Reviewer: autoclaude adversarial reviewer

# Phase 2d-5-3-I — round 9, scoped to 2d-5-3-H's fix (`8e457d1`)

Verdict **ship-with-fixes**. 0 blockers, 2 SHOULD-FIX in source, 1 Low.

**Re-derived and holding** (no finding): `afterSequence` captured pre-await (`:717`) and this arm runs
after it; `open()` bumps `openGeneration` in its first statement and is gated by no drain
(`workspace.svelte.ts:2553-2569`), so *"nothing stops one"* holds; `openedAt !== host.openGeneration()`
is an inequality, so *"nothing here observes whether one did"* holds; both citations exist and do what
is claimed (`workspace.test.ts:1229` runs two overlapping opens inside the *overlapping requests*
suite; `watch_check.rs:514` refuses a reopen and asserts epoch 1, ready, still delivering); both
opening-words anchors resolve **uniquely** (`:743`, `:752`); `drain_external_changes` → `with_workspace_read`
takes the session lock and `open`'s swap block runs under it, so the new time index's referent is real;
E's and F's archived blocks both say *"four times"* (`next-action-history.md:11531`, `:11651` — inside
the "next action is F"/"next action is G" blocks, so H's attribution to E and F is right and the H
review file's own parenthetical is the wrong one); `PROGRESS.md` is exactly 758 lines / 118,304 bytes;
no line > 90; harness pin `5 insertions(+), 1 deletion(-)`.

## SHOULD-FIX 1 — source. `reconciliationCoordinator.ts:800-801`

> asserted by the paragraph opening *"A third state is neither of those"*, and again by **the case-2
> sentence above**

*The queue half* is defined at `:789-790` and pinned at `:796` as **the queue surviving a refused
open** — the third state. The case-2 sentence (`:775-782`) is about a **successful** open that won the
lock race, which the same block at `:771-773` says is *"never this one"*. So the new second citation
names a site the block itself excludes, and the paragraph's own falsifiability test at `:811-812`
("an edit that reset the queue **on the refusal path** would falsify this comment") is not true of it.
H's Low 5 was a citation over-claiming one of two referents; its fix reproduced that shape.
Should say: cite the *"A third state"* paragraph alone for the queue half, and if the case-2 sentence
is named at all, name it as asserting the same property text of a **different** case.

## SHOULD-FIX 2 — source. `reconciliationCoordinator.ts:795-796`

> and **the paragraph above** is not reasoned-only

Left standing inside the paragraph whose next sentence (`:803`) says it names sites by opening words
*"rather than saying the paragraph above"*. The paragraph literally above is `:761-787` (the refused
`list_documents` / case-2 paragraph, which H itself expanded); the one `a_failed_reopen_…` de-reasons
is `:752` (*"A third state is neither of those"*). H fixed one instance of the phrase and left a
narrower one two sentences earlier in the same paragraph — `CLAUDE.md`'s named failure mode.
Should say: *"the paragraph opening "A third state is neither of those" is not reasoned-only"*.

## Low — source. `reconciliationCoordinator.ts:779-782`

*"a further successful open may have installed another lifecycle and **emptied the queue** by then —
nothing stops one, and `./workspace.test.ts`'s … drives two overlapping opens"*. Installing and
emptying are Rust effects; that test uses `scriptedCommands()` and drives no Rust — as `:797-799` says
nine lines below. The citation supports the **host-level** overlap only. H's §7 item 2 records this;
one clause (*"at the host level"*) would close it in the text rather than in the notes.

## NOT-VERIFIED

All four gates (brief forbids running them; no gate reads prose anyway). Whether case 2's property
claim survives `ReconciliationQueue::drain`'s `guard.acknowledged = guard.acknowledged.max(after_sequence)`
(`reconciliation.rs:1186`, `:1210-1211`), which can return the **previous** epoch's number for an empty
new queue — that is the carried 2d-5-3-C finding, and reachability is still unestablished, so it is not
re-raised. `PROGRESS.md:751`'s git-state row names two archives where the header (`:41-45`) names three;
incomplete rather than false. Rust beyond `open`, `drain_external_changes`, `drain`, `begin_epoch`.
