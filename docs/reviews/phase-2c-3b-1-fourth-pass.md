# Phase 2c-3b step 1 — fourth review pass (scoped)

**Reviewer:** Codex, via `codex:codex-rescue`.
**Date:** 2026-08-03.
**Verdict:** `READINESS: NOT READY` — two High findings, both fixed before the next commit.

## Why this pass was commissioned

The 2c-3b step 1 checkpoint left it as an explicit, recorded decision rather than a defect:
three review rounds had run, all fourteen findings were closed, and nothing was blocked — but
**each round's own fix had produced the next round's finding**, and round 3's fixes were never
themselves reviewed. Round 3 changed exactly two things worth a fourth look, and step 2 draws
both of them onto a screen:

1. the **refusal-precedence swap** — `mayHaveWritten` asked above `alreadyMoved` and above the
   liveness check;
2. the **rewritten `mayHaveWritten` copy in both languages**, which is a sentence a person reads
   about their own file.

The pass was scoped to those two changes only. Findings outside the scope were out of scope.

## Findings

### F1 — High. `notMovable` still wins over `outOfDate`, and it is the arm that claims more

`src/lib/browser/matchMove.ts:1075` (as reviewed), contradicting `docs/decisions/2c-3b-1-notes.md`
§9's own stated rule.

`refusalGiven` checked `session.eligibility.kind !== 'movable'` **before**
`session.invalidated || !live`. But `eligibility` is frozen at `startMatchMove`
(`matchMove.ts:773`) and no transition recomputes it, so a session whose snippet was ineligible at
its first parse — then reprojected — still answers the definite *this snippet cannot be moved*,
a claim about the snippet drawn from a projection that has since been replaced. `outOfDate` claims
only that this session is stale, which is the half still known to be true.

This is the **same rule** round 3 applied to `mayHaveWritten`, left unapplied one pair further
down. The existing test exercised `notMovable` only against its original projection
(`matchMove.test.ts:695`), i.e. with `live: true` and `invalidated: false`, so the overlap was
never driven.

**Fix applied:** the liveness/invalidation check moved above the frozen-eligibility check, the
rule written into the doc comment as a rule with its reason rather than as an arrangement of
`if`s, and a precedence test added for the ineligible-plus-stale overlap on both public paths.

### F2 — High. Two comments still justify the terminal state as preventing a repeated write

`src/lib/browser/matchMove.ts:692` and `src/lib/browser/matchMove.ts:1407` (as reviewed).

Both said, in prose, that the session is spent so as not to *repeat* a write that may already have
happened. That is precisely the justification `2c-3b-1-notes.md` §9 rejected and the dictionaries
were rewritten to drop: a session resends its **frozen base revision**, so a successful first write
makes that base stale and a retry **conflicts** rather than duplicating. The terminal state is
justified by **uncertainty and stale identity, never by duplicate execution**.

This is this project's named worst defect class — prose claiming something the code does not do —
surviving in the two comments the dictionary rewrite did not reach.

**Fix applied:** both passages restated on uncertainty and stale identity, each saying explicitly
what the justification is **not**.

## What the pass found clean

- The requested swap itself is correctly centralized: `mayHaveWritten` is first in `refusalGiven`,
  that one function serves **both** public paths (`moveSubmissionRefusal` and `beginMove`), and the
  ordering is pinned in both transition orders plus the invalidated overlap
  (`matchMove.test.ts:915`). **No arm became unreachable** as a result of the swap.
- Both rewritten **English** strings limit themselves to uncertainty and stale identity.
- The **Spanish** strings make the same claims at the same strength, and use `fragmento`
  throughout.
- All **37** `browser.matchMove` keys exist in both dictionaries with matching placeholders.

## Disposition

Both findings fixed in this cut, before the step 2 commit. F1 carries a new test; F2 is prose only
and carries none, because no test can fail a comment — which is the whole reason the class is
named.
